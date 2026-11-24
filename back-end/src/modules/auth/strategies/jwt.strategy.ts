import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { getAuthConfig } from '../../../config/auth.config';
import { REDIS_CLIENT } from '../../../config/redis.config';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

export interface JwtPayload {
  sub: number;
  email: string;
  role: 'learner' | 'admin';
  tokenVersion: number;
  sessionFamilyId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getAuthConfig().jwtAccessSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // 1. Kiểm tra Redis revoked_family & token_version (fallback về PostgreSQL nếu Redis gián đoạn theo FR-013)
    try {
      const [familyRevoked, cachedTokenVersion] = await this.redis.mget(
        `revoked_family:${payload.sessionFamilyId}`,
        `user_token_version:${payload.sub}`,
      );
      if (familyRevoked) {
        throw new UnauthorizedException({
          code: 'SESSION_REVOKED',
          message: 'Phiên đăng nhập đã bị thu hồi',
          details: null,
        });
      }
      if (cachedTokenVersion !== null && Number(cachedTokenVersion) !== payload.tokenVersion) {
        throw new UnauthorizedException({
          code: 'TOKEN_REVOKED',
          message: 'Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại',
          details: null,
        });
      }
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      // Redis unavailable -> fallback to DB check below (FR-013)
    }

    // 2. Xác thực trạng thái tài khoản & token_version trong PostgreSQL
    const rows = await this.dataSource.query(
      `SELECT id, email, role, token_version AS "tokenVersion", is_active AS "isActive" FROM users WHERE id = $1;`,
      [payload.sub],
    );
    if (rows.length === 0) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Tài khoản không tồn tại',
        details: null,
      });
    }

    const user = rows[0];
    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'ACCOUNT_DISABLED',
        message: 'Tài khoản của bạn đã bị khóa bởi quản trị viên',
        details: null,
      });
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException({
        code: 'TOKEN_REVOKED',
        message: 'Phiên đăng nhập đã hết hiệu lực, vui lòng đăng nhập lại',
        details: null,
      });
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
      sessionFamilyId: payload.sessionFamilyId,
    };
  }
}
