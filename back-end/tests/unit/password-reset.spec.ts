import { BadRequestException, HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { AuthService } from '../../src/modules/auth/auth.service';
import { RateLimiterService } from '../../src/modules/auth/rate-limiter.service';
import { AuditService } from '../../src/modules/audit/audit.service';
import {
  PasswordResetMailService,
  buildPasswordResetOtpEmail,
} from '../../src/modules/auth/password-reset-mail.service';

describe('AuthService — OTP Forgot & Reset Password (US6-AS2, FR-016)', () => {
  function buildHarness() {
    const store = new Map<string, { value: string; ttl: number }>();
    const redisMock = {
      mget: jest.fn(async (...keys: string[]) => keys.map((k) => store.get(k)?.value ?? null)),
      get: jest.fn(async (key: string) => store.get(key)?.value ?? null),
      set: jest.fn(async (key: string, val: string, _mode?: string, ttl?: number) => {
        store.set(key, { value: val, ttl: ttl ?? 600 });
        return 'OK';
      }),
      del: jest.fn(async (key: string) => {
        store.delete(key);
        return 1;
      }),
      ttl: jest.fn(async (key: string) => store.get(key)?.ttl ?? -2),
      multi: jest.fn(() => {
        const ops: Array<() => void> = [];
        const chain = {
          incr: (k: string) => {
            ops.push(() => {
              const cur = Number(store.get(k)?.value ?? 0) + 1;
              store.set(k, { value: String(cur), ttl: store.get(k)?.ttl ?? 900 });
            });
            return chain;
          },
          expire: () => chain,
          exec: async () => {
            ops.forEach((fn) => fn());
            return [];
          },
        };
        return chain;
      }),
    } as unknown as Redis;

    const qrQueries: Array<{ sql: string; params?: unknown[] }> = [];
    const qrMock = {
      connect: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      commitTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        qrQueries.push({ sql, params });
        return [];
      }),
    };

    const users = [
      { id: 7, email: 'sv01@vnua.edu.vn', full_name: 'Sinh Viên 01', token_version: 2, is_active: true },
    ];

    const dataSourceMock = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('FROM users WHERE email = $1')) {
          const email = params?.[0];
          return users.filter((u) => u.email === email);
        }
        return [];
      }),
      createQueryRunner: jest.fn(() => qrMock),
    } as unknown as DataSource;

    const auditLogs: unknown[] = [];
    const auditMock = {
      log: jest.fn(async (entry: unknown) => {
        auditLogs.push(entry);
      }),
    } as unknown as AuditService;

    const rateLimiterMock = {
      resetAccountFailures: jest.fn(async () => undefined),
    } as unknown as RateLimiterService;

    let capturedOtp = '';
    const mailMock = {
      sendPasswordResetOtp: jest.fn(async (_email: string, _name: string, otp: string) => {
        capturedOtp = otp;
      }),
    } as unknown as PasswordResetMailService;

    const service = new AuthService(
      dataSourceMock,
      new JwtService({ secret: 'test-secret' }),
      rateLimiterMock,
      auditMock,
      redisMock,
      mailMock,
    );

    return {
      service,
      store,
      qrQueries,
      auditLogs,
      mailMock,
      getCapturedOtp: () => capturedOtp,
    };
  }

  it('generates 6-digit OTP (hashed in Redis, 600s TTL), resets password, revokes sessions, and blocks reuse', async () => {
    const h = buildHarness();

    // Non-existent email returns anti-enumeration response without sending mail
    const unknownRes = await h.service.forgotPassword({ email: 'nobody@vnua.edu.vn' }, '127.0.0.1');
    expect(unknownRes.message).toContain('OTP 6 chữ số');
    expect(h.mailMock.sendPasswordResetOtp).not.toHaveBeenCalled();

    // Existing active user receives 6-digit OTP
    await h.service.forgotPassword({ email: 'sv01@vnua.edu.vn' }, '127.0.0.1');
    const otp = h.getCapturedOtp();
    expect(otp).toMatch(/^\d{6}$/);
    const storedRaw = h.store.get('auth:pwd_reset:sv01@vnua.edu.vn');
    expect(storedRaw?.ttl).toBe(600);
    expect(storedRaw?.value).not.toContain(otp); // Stored as SHA-256 hash only

    // Valid OTP resets password, increments token_version (2 -> 3), revokes refresh_sessions, logs audit
    await h.service.resetPassword(
      { email: 'sv01@vnua.edu.vn', otp, newPassword: 'NewStrongPass123' },
      '127.0.0.1',
    );
    expect(h.qrQueries).toHaveLength(2);
    expect(h.qrQueries[0].params?.[1]).toBe(3);
    expect(h.qrQueries[1].sql).toContain('UPDATE refresh_sessions');
    expect(h.auditLogs).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: 'AUTH_PASSWORD_RESET' })]),
    );

    // One-time use: re-submitting the same OTP fails immediately
    await expect(
      h.service.resetPassword(
        { email: 'sv01@vnua.edu.vn', otp, newPassword: 'AnotherPass123' },
        '127.0.0.1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('enforces 3-per-15m forgot-password rate limit and invalidates OTP after 5 wrong attempts', async () => {
    const h = buildHarness();

    await h.service.forgotPassword({ email: 'sv01@vnua.edu.vn' }, '10.0.0.1');
    const realOtp = h.getCapturedOtp();

    // 5 wrong attempts -> 5th attempt deletes OTP and throws OTP_MAX_ATTEMPTS_EXCEEDED
    for (let i = 1; i <= 4; i++) {
      await expect(
        h.service.resetPassword({
          email: 'sv01@vnua.edu.vn',
          otp: '000000',
          newPassword: 'NewStrongPass123',
        }),
      ).rejects.toThrow('Mã OTP không chính xác');
    }
    await expect(
      h.service.resetPassword({
        email: 'sv01@vnua.edu.vn',
        otp: '000000',
        newPassword: 'NewStrongPass123',
      }),
    ).rejects.toThrow('quá 5 lần');

    // Even the real OTP is now invalidated
    await expect(
      h.service.resetPassword({
        email: 'sv01@vnua.edu.vn',
        otp: realOtp,
        newPassword: 'NewStrongPass123',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    // 2nd and 3rd requests succeed; 4th within 15 minutes hits 429 RATE_LIMIT_EXCEEDED
    await h.service.forgotPassword({ email: 'sv01@vnua.edu.vn' }, '10.0.0.1');
    await h.service.forgotPassword({ email: 'sv01@vnua.edu.vn' }, '10.0.0.1');
    await expect(
      h.service.forgotPassword({ email: 'sv01@vnua.edu.vn' }, '10.0.0.1'),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('builds a professional bilingual (VI + EN) HTML and plain-text OTP email with HTML escaping', () => {
    const mail = buildPasswordResetOtpEmail({
      fullName: 'Nguyễn <An> & "Bạn"',
      otp: '482910',
      expiresMinutes: 10,
    });

    expect(mail.subject).toContain('482910');
    expect(mail.subject).toContain('Password Reset Code');
    expect(mail.text).toContain('[TIẾNG VIỆT]');
    expect(mail.text).toContain('[ENGLISH]');
    expect(mail.text).toContain('482910');
    expect(mail.html).toContain('482910');
    expect(mail.html).toContain('LexiTag Learning Lab');
    expect(mail.html).toContain('We received a request to reset the password');
    expect(mail.html).toContain('Nguyễn &lt;An&gt; &amp; &quot;Bạn&quot;');
    expect(mail.html).not.toContain('<An>');
  });
});
