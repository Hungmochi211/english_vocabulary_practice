import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { AppModule, configureNestApp } from '../../src/app.module';
import { REDIS_CLIENT } from '../../src/config/redis.config';
import { PasswordResetMailService } from '../../src/modules/auth/password-reset-mail.service';

describe('Password Reset OTP E2E (US6-AS2, FR-016)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redis: Redis;
  let mailService: PasswordResetMailService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureNestApp(app);
    await app.init();

    dataSource = app.get(DataSource);
    redis = app.get(REDIS_CLIENT);
    mailService = app.get(PasswordResetMailService);

    await redis.flushdb();
    await dataSource.query(
      'TRUNCATE TABLE audit_logs, refresh_sessions, user_streaks, users RESTART IDENTITY CASCADE;',
    );
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('US6-AS2: completes forgot-password OTP -> reset-password -> revokes old sessions & logs in with new password', async () => {
    let sentOtp = '';
    const spy = jest
      .spyOn(mailService, 'sendPasswordResetOtp')
      .mockImplementation(async (_email, _name, otp) => {
        sentOtp = otp;
      });

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'reset_user@vnua.edu.vn',
        password: 'OldPassword123',
        fullName: 'Học Viên Reset',
      })
      .expect(201);
    const oldAccessToken = reg.body.data.accessToken;
    const oldRefreshToken = reg.body.data.refreshToken;

    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset_user@vnua.edu.vn' })
      .expect(200);
    expect(sentOtp).toMatch(/^\d{6}$/);

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({
        email: 'reset_user@vnua.edu.vn',
        otp: sentOtp,
        newPassword: 'BrandNewPass456',
      })
      .expect(200);

    // Old access & refresh tokens are immediately revoked
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${oldAccessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(401);

    // Login with new password succeeds
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'reset_user@vnua.edu.vn', password: 'BrandNewPass456' })
      .expect(200);

    spy.mockRestore();
  });
});
