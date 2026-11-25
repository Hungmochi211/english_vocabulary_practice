import {
  Injectable,
  Inject,
  Optional,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import Redis from 'ioredis';
import { getAuthConfig } from '../../config/auth.config';
import { REDIS_CLIENT } from '../../config/redis.config';
import { AuditService } from '../audit/audit.service';
import { RateLimiterService } from './rate-limiter.service';
import { PasswordResetMailService } from './password-reset-mail.service';
import {
  RegisterDto,
  LoginDto,
  GoogleLoginDto,
  RefreshDto,
  LogoutDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';

export interface GoogleTokenPayload {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture: string | null;
}

export interface SafeUserProfile {
  id: number;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  targetLevel: string;
  role: 'learner' | 'admin';
  authProvider: 'local' | 'google';
  emailReminderEnabled: boolean;
  isActive: boolean;
  createdAt: Date;
}

const VALID_GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly rateLimiter: RateLimiterService,
    private readonly auditService: AuditService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Optional() private readonly passwordResetMailService?: PasswordResetMailService,
  ) {
    this.googleClient = new OAuth2Client(getAuthConfig().googleClientId);
  }

  private hashRefreshToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  private mapSafeUser(row: Record<string, unknown>): SafeUserProfile {
    return {
      id: Number(row.id),
      email: String(row.email),
      fullName: String(row.full_name ?? row.fullName),
      avatarUrl: (row.avatar_url ?? row.avatarUrl ?? null) as string | null,
      targetLevel: String(row.target_level ?? row.targetLevel ?? 'B1'),
      role: (row.role as 'learner' | 'admin') ?? 'learner',
      authProvider: (row.auth_provider ?? row.authProvider ?? 'local') as 'local' | 'google',
      emailReminderEnabled: Boolean(row.email_reminder_enabled ?? row.emailReminderEnabled ?? true),
      isActive: Boolean(row.is_active ?? row.isActive ?? true),
      createdAt: (row.created_at ?? row.createdAt) as Date,
    };
  }

  private async issueSessionTokens(
    user: { id: number; email: string; role: 'learner' | 'admin'; tokenVersion: number },
    familyId: string,
    ipAddress?: string | null,
    userAgent?: string | null,
  ): Promise<{ accessToken: string; refreshToken: string; refreshTokenHash: string; expiresIn: number }> {
    const cfg = getAuthConfig();
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        tokenVersion: user.tokenVersion,
        sessionFamilyId: familyId,
      },
      {
        secret: cfg.jwtAccessSecret,
        expiresIn: cfg.jwtAccessExpiresIn,
      },
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(Date.now() + cfg.jwtRefreshExpiresDays * 86400 * 1000);

    await this.dataSource.query(
      `
      INSERT INTO refresh_sessions (user_id, session_family_id, token_hash, user_agent, ip_address, expires_at)
      VALUES ($1, $2::uuid, $3, $4, $5, $6);
      `,
      [user.id, familyId, refreshTokenHash, userAgent ?? null, ipAddress ?? null, expiresAt],
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenHash,
      expiresIn: cfg.jwtAccessExpiresIn,
    };
  }

  async register(dto: RegisterDto, ipAddress?: string | null, userAgent?: string | null) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.dataSource.query(
      `SELECT id FROM users WHERE email = $1;`,
      [email],
    );
    if (existing.length > 0) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'Email đã được sử dụng',
        details: null,
      });
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let createdUserRow: Record<string, unknown>;
    try {
      const inserted = await queryRunner.query(
        `
        INSERT INTO users (email, password_hash, full_name, role, auth_provider, email_reminder_enabled, token_version, is_active)
        VALUES ($1, $2, $3, 'learner', 'local', TRUE, 1, TRUE)
        RETURNING id, email, full_name, avatar_url, target_level, role, auth_provider, email_reminder_enabled, token_version, is_active, created_at;
        `,
        [email, passwordHash, dto.fullName.trim()],
      );
      createdUserRow = inserted[0];

      await queryRunner.query(
        `
        INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_study_date)
        VALUES ($1, 0, 0, NULL);
        `,
        [createdUserRow.id],
      );

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    const familyId = crypto.randomUUID();
    const tokens = await this.issueSessionTokens(
      {
        id: Number(createdUserRow.id),
        email: String(createdUserRow.email),
        role: createdUserRow.role as 'learner' | 'admin',
        tokenVersion: Number(createdUserRow.token_version),
      },
      familyId,
      ipAddress,
      userAgent,
    );

    await this.auditService.log({
      actorUserId: Number(createdUserRow.id),
      action: 'AUTH_REGISTER',
      targetType: 'user',
      targetId: Number(createdUserRow.id),
      status: 'SUCCESS',
      ipAddress,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.mapSafeUser(createdUserRow),
    };
  }

  async login(dto: LoginDto, ipAddress?: string | null, userAgent?: string | null) {
    const email = dto.email.trim().toLowerCase();
    const ip = ipAddress || 'unknown';

    await this.rateLimiter.assertNotLocked(ip, email);

    const rows = await this.dataSource.query(
      `
      SELECT id, email, password_hash, full_name, avatar_url, target_level, role, auth_provider,
             email_reminder_enabled, token_version, is_active, created_at
      FROM users
      WHERE email = $1;
      `,
      [email],
    );

    if (rows.length === 0 || !rows[0].password_hash) {
      await this.rateLimiter.recordFailedAttempt(ip, email);
      await this.auditService.log({
        actorUserId: null,
        action: 'AUTH_LOGIN_FAILED',
        targetType: 'user',
        targetId: email,
        status: 'FAILED',
        ipAddress: ip,
      });
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không chính xác',
        details: null,
      });
    }

    const userRow = rows[0];
    if (!userRow.is_active) {
      throw new ForbiddenException({
        code: 'ACCOUNT_DISABLED',
        message: 'Tài khoản của bạn đã bị khóa bởi quản trị viên',
        details: null,
      });
    }

    const matched = await bcrypt.compare(dto.password, userRow.password_hash);
    if (!matched) {
      await this.rateLimiter.recordFailedAttempt(ip, email);
      await this.auditService.log({
        actorUserId: userRow.id,
        action: 'AUTH_LOGIN_FAILED',
        targetType: 'user',
        targetId: userRow.id,
        status: 'FAILED',
        ipAddress: ip,
      });
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không chính xác',
        details: null,
      });
    }

    await this.rateLimiter.resetAccountFailures(email);

    const familyId = crypto.randomUUID();
    const tokens = await this.issueSessionTokens(
      {
        id: userRow.id,
        email: userRow.email,
        role: userRow.role,
        tokenVersion: userRow.token_version,
      },
      familyId,
      ip,
      userAgent,
    );

    await this.auditService.log({
      actorUserId: userRow.id,
      action: 'AUTH_LOGIN_SUCCESS',
      targetType: 'user',
      targetId: userRow.id,
      status: 'SUCCESS',
      ipAddress: ip,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.mapSafeUser(userRow),
    };
  }

  async verifyGoogleIdToken(idToken: string): Promise<GoogleTokenPayload> {
    const cfg = getAuthConfig();
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: cfg.googleClientId,
      });
      const payload = ticket.getPayload();
      if (
        !payload ||
        !payload.sub ||
        !payload.email ||
        !payload.iss ||
        !VALID_GOOGLE_ISSUERS.has(payload.iss) ||
        (payload.exp && payload.exp * 1000 <= Date.now())
      ) {
        throw new UnauthorizedException({
          code: 'INVALID_GOOGLE_TOKEN',
          message: 'Mã xác thực Google không hợp lệ hoặc đã hết hạn',
          details: null,
        });
      }
      return {
        sub: payload.sub,
        email: payload.email.trim().toLowerCase(),
        emailVerified: Boolean(payload.email_verified),
        name: payload.name || payload.email.split('@')[0],
        picture: payload.picture || null,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : '';
      if (
        msg.includes('Wrong number of segments') ||
        msg.includes('Invalid token') ||
        msg.includes('Token used too late') ||
        msg.includes('Wrong recipient')
      ) {
        throw new UnauthorizedException({
          code: 'INVALID_GOOGLE_TOKEN',
          message: 'Mã xác thực Google không hợp lệ hoặc đã hết hạn',
          details: null,
        });
      }
      throw new Error('GOOGLE_PROVIDER_UNAVAILABLE');
    }
  }

  async loginWithGoogle(
    dto: GoogleLoginDto,
    ipAddress?: string | null,
    userAgent?: string | null,
  ) {
    let googleUser: GoogleTokenPayload;
    try {
      googleUser = await this.verifyGoogleIdToken(dto.idToken);
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Dịch vụ xác thực Google tạm thời gián đoạn, vui lòng thử lại sau ít phút',
        details: null,
      });
    }

    if (!googleUser.emailVerified) {
      throw new UnauthorizedException({
        code: 'GOOGLE_EMAIL_UNVERIFIED',
        message: 'Vui lòng xác thực email Google trước khi đăng nhập',
        details: null,
      });
    }

    const email = googleUser.email.trim().toLowerCase();
    const existing = await this.dataSource.query(
      `
      SELECT id, email, full_name, avatar_url, target_level, role, auth_provider, google_id,
             email_reminder_enabled, token_version, is_active, created_at
      FROM users
      WHERE email = $1 OR google_id = $2
      LIMIT 1;
      `,
      [email, googleUser.sub],
    );

    let userRow: Record<string, unknown>;
    if (existing.length > 0) {
      userRow = existing[0];
      if (!userRow.is_active) {
        throw new ForbiddenException({
          code: 'ACCOUNT_DISABLED',
          message: 'Tài khoản của bạn đã bị khóa bởi quản trị viên',
          details: null,
        });
      }
      if (!userRow.google_id) {
        const updated = await this.dataSource.query(
          `
          UPDATE users
          SET google_id = $1,
              avatar_url = COALESCE(avatar_url, $2),
              updated_at = NOW()
          WHERE id = $3
          RETURNING id, email, full_name, avatar_url, target_level, role, auth_provider,
                    email_reminder_enabled, token_version, is_active, created_at;
          `,
          [googleUser.sub, googleUser.picture, userRow.id],
        );
        userRow = Array.isArray(updated[0]) ? updated[0][0] : updated[0];
      }
    } else {
      const qr = this.dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        const inserted = await qr.query(
          `
          INSERT INTO users (email, password_hash, full_name, avatar_url, role, auth_provider, google_id, email_reminder_enabled, token_version, is_active)
          VALUES ($1, NULL, $2, $3, 'learner', 'google', $4, TRUE, 1, TRUE)
          RETURNING id, email, full_name, avatar_url, target_level, role, auth_provider,
                    email_reminder_enabled, token_version, is_active, created_at;
          `,
          [email, googleUser.name.slice(0, 100), googleUser.picture, googleUser.sub],
        );
        userRow = inserted[0];
        await qr.query(
          `INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_study_date) VALUES ($1, 0, 0, NULL);`,
          [userRow.id],
        );
        await qr.commitTransaction();
      } catch (err) {
        await qr.rollbackTransaction();
        throw err;
      } finally {
        await qr.release();
      }
    }

    const familyId = crypto.randomUUID();
    const tokens = await this.issueSessionTokens(
      {
        id: Number(userRow.id),
        email: String(userRow.email),
        role: userRow.role as 'learner' | 'admin',
        tokenVersion: Number(userRow.token_version),
      },
      familyId,
      ipAddress,
      userAgent,
    );

    await this.auditService.log({
      actorUserId: Number(userRow.id),
      action: 'AUTH_GOOGLE_LOGIN',
      targetType: 'user',
      targetId: Number(userRow.id),
      status: 'SUCCESS',
      ipAddress,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.mapSafeUser(userRow),
    };
  }

  async refresh(dto: RefreshDto, ipAddress?: string | null, userAgent?: string | null) {
    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    const cfg = getAuthConfig();

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const sessions = await qr.query(
        `
        SELECT rs.id, rs.user_id, rs.session_family_id, rs.token_hash, rs.replaced_by_hash,
               rs.is_revoked, rs.expires_at,
               u.email, u.full_name, u.avatar_url, u.target_level, u.role, u.auth_provider,
               u.email_reminder_enabled, u.token_version, u.is_active, u.created_at
        FROM refresh_sessions rs
        INNER JOIN users u ON u.id = rs.user_id
        WHERE rs.token_hash = $1
        FOR UPDATE OF rs;
        `,
        [tokenHash],
      );

      if (sessions.length === 0) {
        await qr.rollbackTransaction();
        throw new UnauthorizedException({
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Mã làm mới phiên không hợp lệ',
          details: null,
        });
      }

      const session = sessions[0];

      if (!session.is_active) {
        await qr.rollbackTransaction();
        throw new ForbiddenException({
          code: 'ACCOUNT_DISABLED',
          message: 'Tài khoản của bạn đã bị khóa bởi quản trị viên',
          details: null,
        });
      }

      // Reuse Detection (FR-003, US1-AS7)
      if (session.replaced_by_hash !== null) {
        await qr.query(
          `
          UPDATE refresh_sessions
          SET is_revoked = TRUE, revoked_at = COALESCE(revoked_at, NOW())
          WHERE session_family_id = $1;
          `,
          [session.session_family_id],
        );
        await qr.commitTransaction();

        try {
          await this.redis.set(
            `revoked_family:${session.session_family_id}`,
            '1',
            'EX',
            cfg.jwtAccessExpiresIn,
          );
        } catch {
          throw new ServiceUnavailableException({
            code: 'SERVICE_UNAVAILABLE',
            message: 'Dịch vụ tạm thời gián đoạn, vui lòng thử lại sau ít phút',
            details: null,
          });
        }

        await this.auditService.log({
          actorUserId: session.user_id,
          action: 'AUTH_REUSE_DETECTED',
          targetType: 'session',
          targetId: session.session_family_id,
          status: 'FAILED',
          ipAddress,
        });

        throw new UnauthorizedException({
          code: 'TOKEN_REUSE_DETECTED',
          message: 'Phát hiện mã làm mới cũ bị dùng lại, toàn bộ phiên đã bị thu hồi',
          details: null,
        });
      }

      if (session.is_revoked || new Date(session.expires_at).getTime() <= Date.now()) {
        await qr.rollbackTransaction();
        throw new UnauthorizedException({
          code: 'REFRESH_TOKEN_REVOKED',
          message: 'Phiên đăng nhập đã bị thu hồi hoặc hết hạn',
          details: null,
        });
      }

      const newRefreshToken = crypto.randomBytes(32).toString('hex');
      const newHash = this.hashRefreshToken(newRefreshToken);
      const newExpiresAt = new Date(Date.now() + cfg.jwtRefreshExpiresDays * 86400 * 1000);

      await qr.query(
        `
        UPDATE refresh_sessions
        SET replaced_by_hash = $1
        WHERE id = $2;
        `,
        [newHash, session.id],
      );

      await qr.query(
        `
        INSERT INTO refresh_sessions (user_id, session_family_id, token_hash, user_agent, ip_address, expires_at)
        VALUES ($1, $2::uuid, $3, $4, $5, $6);
        `,
        [
          session.user_id,
          session.session_family_id,
          newHash,
          userAgent ?? null,
          ipAddress ?? null,
          newExpiresAt,
        ],
      );

      await qr.commitTransaction();

      const accessToken = await this.jwtService.signAsync(
        {
          sub: session.user_id,
          email: session.email,
          role: session.role,
          tokenVersion: session.token_version,
          sessionFamilyId: session.session_family_id,
        },
        {
          secret: cfg.jwtAccessSecret,
          expiresIn: cfg.jwtAccessExpiresIn,
        },
      );

      return {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: cfg.jwtAccessExpiresIn,
        user: this.mapSafeUser({
          id: session.user_id,
          email: session.email,
          full_name: session.full_name,
          avatar_url: session.avatar_url,
          target_level: session.target_level,
          role: session.role,
          auth_provider: session.auth_provider,
          email_reminder_enabled: session.email_reminder_enabled,
          is_active: session.is_active,
          created_at: session.created_at,
        }),
      };
    } catch (err) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      throw err;
    } finally {
      await qr.release();
    }
  }

  async logout(userId: number, dto: LogoutDto, ipAddress?: string | null) {
    const tokenHash = this.hashRefreshToken(dto.refreshToken);
    await this.dataSource.query(
      `
      UPDATE refresh_sessions
      SET is_revoked = TRUE, revoked_at = COALESCE(revoked_at, NOW())
      WHERE user_id = $1 AND token_hash = $2;
      `,
      [userId, tokenHash],
    );

    await this.auditService.log({
      actorUserId: userId,
      action: 'AUTH_LOGOUT',
      targetType: 'user',
      targetId: userId,
      status: 'SUCCESS',
      ipAddress,
    });

    return null;
  }

  async changePassword(userId: number, dto: ChangePasswordDto, ipAddress?: string | null) {
    const cfg = getAuthConfig();
    const rows = await this.dataSource.query(
      `SELECT id, password_hash, token_version FROM users WHERE id = $1;`,
      [userId],
    );
    if (rows.length === 0) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Tài khoản không tồn tại',
        details: null,
      });
    }

    const user = rows[0];
    if (!user.password_hash) {
      throw new BadRequestException({
        code: 'PASSWORD_NOT_SET',
        message: 'Tài khoản Google chưa thiết lập mật khẩu đăng nhập trực tiếp',
        details: null,
      });
    }

    const matched = await bcrypt.compare(dto.currentPassword, user.password_hash);
    if (!matched) {
      throw new UnauthorizedException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Mật khẩu hiện tại không chính xác',
        details: null,
      });
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    const nextTokenVersion = Number(user.token_version) + 1;

    // Fail-closed Redis check before revoking across devices (FR-013)
    try {
      await this.redis.ping();
    } catch {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Dịch vụ tạm thời gián đoạn, vui lòng thử lại sau ít phút',
        details: null,
      });
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(
        `
        UPDATE users
        SET password_hash = $1, token_version = $2, updated_at = NOW()
        WHERE id = $3;
        `,
        [newHash, nextTokenVersion, userId],
      );
      await qr.query(
        `
        UPDATE refresh_sessions
        SET is_revoked = TRUE, revoked_at = COALESCE(revoked_at, NOW())
        WHERE user_id = $1 AND is_revoked = FALSE;
        `,
        [userId],
      );
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    await this.redis.set(
      `user_token_version:${userId}`,
      String(nextTokenVersion),
      'EX',
      cfg.jwtAccessExpiresIn,
    );

    await this.auditService.log({
      actorUserId: userId,
      action: 'AUTH_PASSWORD_CHANGED',
      targetType: 'user',
      targetId: userId,
      status: 'SUCCESS',
      ipAddress,
    });

    return null;
  }

  async forgotPassword(dto: ForgotPasswordDto, ipAddress?: string | null) {
    const email = dto.email.trim().toLowerCase();
    const ip = ipAddress || 'unknown';
    const emailRlKey = `auth:pwd_reset_rl:email:${email}`;
    const ipRlKey = `auth:pwd_reset_rl:ip:${ip}`;
    const otpKey = `auth:pwd_reset:${email}`;

    let emailCount = 0;
    let ipCount = 0;
    try {
      const [eVal, ipVal] = await this.redis.mget(emailRlKey, ipRlKey);
      emailCount = eVal ? Number(eVal) : 0;
      ipCount = ipVal ? Number(ipVal) : 0;
    } catch {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Dịch vụ tạm thời gián đoạn, vui lòng thử lại sau ít phút',
        details: null,
      });
    }

    if (emailCount >= 3 || ipCount >= 10) {
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Bạn đã yêu cầu gửi mã OTP quá nhiều lần, vui lòng thử lại sau 15 phút',
          details: null,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      const pipeline = this.redis.multi();
      pipeline.incr(emailRlKey);
      pipeline.expire(emailRlKey, 900, 'NX');
      pipeline.incr(ipRlKey);
      pipeline.expire(ipRlKey, 900, 'NX');
      await pipeline.exec();
    } catch {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Dịch vụ tạm thời gián đoạn, vui lòng thử lại sau ít phút',
        details: null,
      });
    }

    const rows = await this.dataSource.query(
      `SELECT id, email, full_name, is_active FROM users WHERE email = $1 LIMIT 1;`,
      [email],
    );

    if (rows.length > 0 && rows[0].is_active) {
      const user = rows[0];
      const otp = String(crypto.randomInt(100000, 1000000));
      const otpHash = this.hashRefreshToken(otp);

      try {
        await this.redis.set(otpKey, JSON.stringify({ otpHash, attempts: 0 }), 'EX', 600);
      } catch {
        throw new ServiceUnavailableException({
          code: 'SERVICE_UNAVAILABLE',
          message: 'Dịch vụ tạm thời gián đoạn, vui lòng thử lại sau ít phút',
          details: null,
        });
      }

      if (this.passwordResetMailService) {
        await this.passwordResetMailService.sendPasswordResetOtp(
          email,
          String(user.full_name || email),
          otp,
        );
      }

      await this.auditService.log({
        actorUserId: Number(user.id),
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        targetType: 'user',
        targetId: Number(user.id),
        status: 'SUCCESS',
        ipAddress,
      });
    }

    return {
      message:
        'Nếu địa chỉ email tồn tại và đang hoạt động, mã OTP 6 chữ số đã được gửi tới hộp thư của bạn (hiệu lực 10 phút).',
    };
  }

  async resetPassword(dto: ResetPasswordDto, ipAddress?: string | null) {
    const email = dto.email.trim().toLowerCase();
    const otp = dto.otp.trim();
    const otpKey = `auth:pwd_reset:${email}`;
    const cfg = getAuthConfig();

    let rawStored: string | null = null;
    try {
      rawStored = await this.redis.get(otpKey);
    } catch {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Dịch vụ tạm thời gián đoạn, vui lòng thử lại sau ít phút',
        details: null,
      });
    }

    if (!rawStored) {
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_OTP',
        message: 'Mã OTP không chính xác hoặc đã hết hạn',
        details: null,
      });
    }

    let parsed: { otpHash?: string; attempts?: number } = {};
    try {
      parsed = JSON.parse(rawStored) as { otpHash?: string; attempts?: number };
    } catch {
      await this.redis.del(otpKey);
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_OTP',
        message: 'Mã OTP không chính xác hoặc đã hết hạn',
        details: null,
      });
    }

    const candidateHash = this.hashRefreshToken(otp);
    if (!parsed.otpHash || candidateHash !== parsed.otpHash) {
      const nextAttempts = Number(parsed.attempts ?? 0) + 1;
      if (nextAttempts >= 5) {
        await this.redis.del(otpKey);
        throw new BadRequestException({
          code: 'OTP_MAX_ATTEMPTS_EXCEEDED',
          message: 'Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng yêu cầu gửi mã mới.',
          details: null,
        });
      }
      const remainingTtl = await this.redis.ttl(otpKey);
      const safeTtl = remainingTtl > 0 ? remainingTtl : 600;
      await this.redis.set(
        otpKey,
        JSON.stringify({ otpHash: parsed.otpHash, attempts: nextAttempts }),
        'EX',
        safeTtl,
      );
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_OTP',
        message: 'Mã OTP không chính xác hoặc đã hết hạn',
        details: null,
      });
    }

    const rows = await this.dataSource.query(
      `SELECT id, token_version, is_active FROM users WHERE email = $1 LIMIT 1;`,
      [email],
    );
    if (rows.length === 0) {
      await this.redis.del(otpKey);
      throw new BadRequestException({
        code: 'INVALID_OR_EXPIRED_OTP',
        message: 'Mã OTP không chính xác hoặc đã hết hạn',
        details: null,
      });
    }

    const user = rows[0];
    if (!user.is_active) {
      await this.redis.del(otpKey);
      throw new ForbiddenException({
        code: 'ACCOUNT_DISABLED',
        message: 'Tài khoản của bạn đã bị khóa bởi quản trị viên',
        details: null,
      });
    }

    // One-time use: consume OTP immediately before updating password
    await this.redis.del(otpKey);

    const userId = Number(user.id);
    const newHash = await bcrypt.hash(dto.newPassword, 10);
    const nextTokenVersion = Number(user.token_version) + 1;

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(
        `
        UPDATE users
        SET password_hash = $1, token_version = $2, updated_at = NOW()
        WHERE id = $3;
        `,
        [newHash, nextTokenVersion, userId],
      );
      await qr.query(
        `
        UPDATE refresh_sessions
        SET is_revoked = TRUE, revoked_at = COALESCE(revoked_at, NOW())
        WHERE user_id = $1 AND is_revoked = FALSE;
        `,
        [userId],
      );
      await qr.commitTransaction();
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    await this.redis.set(
      `user_token_version:${userId}`,
      String(nextTokenVersion),
      'EX',
      cfg.jwtAccessExpiresIn,
    );
    await this.rateLimiter.resetAccountFailures(email);

    await this.auditService.log({
      actorUserId: userId,
      action: 'AUTH_PASSWORD_RESET',
      targetType: 'user',
      targetId: userId,
      status: 'SUCCESS',
      ipAddress,
    });

    return null;
  }
}
