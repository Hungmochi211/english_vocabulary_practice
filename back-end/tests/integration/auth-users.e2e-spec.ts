import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { AppModule, configureNestApp } from '../../src/app.module';
import { AuthService } from '../../src/modules/auth/auth.service';
import { REDIS_CLIENT } from '../../src/config/redis.config';

describe('Auth & Users Integration Tests (US1-AS1..US1-AS15)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authService: AuthService;
  let redis: Redis;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureNestApp(app);
    await app.init();

    dataSource = app.get(DataSource);
    authService = app.get(AuthService);
    redis = app.get<Redis>(REDIS_CLIENT);

    await dataSource.query(
      'TRUNCATE TABLE audit_logs, daily_study_logs, user_streaks, user_sm2_reviews, quiz_attempt_answers, quiz_attempts, user_lesson_progress, refresh_sessions, users RESTART IDENTITY CASCADE;',
    );
    await redis.flushdb();
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit().catch(() => {});
    }
    if (app) {
      await app.close();
    }
  });

  it('US1-AS1 & US1-AS2: Đăng ký thành công, khởi tạo streak=0, loại bỏ trường nhạy cảm, và từ chối email trùng (kể cả viết hoa/khoảng trắng)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: '  SV01@vnua.edu.vn ',
        password: 'Password123',
        fullName: 'Nguyễn Văn A',
      })
      .expect(201);

    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe('sv01@vnua.edu.vn');
    expect(res.body.data.user.role).toBe('learner');
    expect(res.body.data.user.emailReminderEnabled).toBe(true);
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.password_hash).toBeUndefined();
    expect(res.body.data.user.tokenVersion).toBeUndefined();

    const streakRows = await dataSource.query(
      'SELECT current_streak, longest_streak FROM user_streaks WHERE user_id = $1;',
      [res.body.data.user.id],
    );
    expect(streakRows).toHaveLength(1);
    expect(streakRows[0].current_streak).toBe(0);

    // US1-AS2: trùng email
    const dup = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'sv01@vnua.edu.vn',
        password: 'Password123',
        fullName: 'Nguyễn Văn A',
      })
      .expect(409);
    expect(dup.body.success).toBe(false);
    expect(dup.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('US1-AS3: Đăng nhập đúng thành công; sai mật khẩu hoặc email không tồn tại trả cùng thông báo chung 401', async () => {
    const ok = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sv01@vnua.edu.vn', password: 'Password123' })
      .expect(200);
    expect(ok.body.data.accessToken).toBeDefined();

    const badPass = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sv01@vnua.edu.vn', password: 'WrongPassword1' })
      .expect(401);
    const badEmail = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'nonexistent@vnua.edu.vn', password: 'Password123' })
      .expect(401);

    expect(badPass.body.error.message).toBe('Email hoặc mật khẩu không chính xác');
    expect(badEmail.body.error.message).toBe('Email hoặc mật khẩu không chính xác');
  });

  it('US1-AS6: Đăng xuất thu hồi ngay refresh token nhưng access token vẫn dùng được tới khi hết hạn', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sv01@vnua.edu.vn', password: 'Password123' })
      .expect(200);
    const { accessToken, refreshToken } = login.body.data;

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken })
      .expect(200);

    // Refresh token bị thu hồi ngay
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    // Access token cũ vẫn được chấp nhận (hết hạn tự nhiên tối đa 15 phút)
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('US1-AS7: Refresh Token Rotation cấp R2 và vô hiệu R1; dùng lại R1 kích hoạt Reuse Detection thu hồi cả family', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sv01@vnua.edu.vn', password: 'Password123' })
      .expect(200);
    const r1 = login.body.data.refreshToken;

    const refreshed = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: r1 })
      .expect(200);
    const r2 = refreshed.body.data.refreshToken;
    const access2 = refreshed.body.data.accessToken;
    expect(r2).not.toBe(r1);

    // Dùng lại R1 -> 401 TOKEN_REUSE_DETECTED & thu hồi cả R2 lẫn access2
    const reuse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: r1 })
      .expect(401);
    expect(reuse.body.error.code).toBe('TOKEN_REUSE_DETECTED');

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: r2 })
      .expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${access2}`)
      .expect(401);
  });

  it('US1-AS8, US1-AS9, US1-AS10: Đổi mật khẩu sai mật khẩu cũ từ chối; đúng mật khẩu cũ thu hồi tức thì mọi phiên đa thiết bị', async () => {
    const dev1 = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sv01@vnua.edu.vn', password: 'Password123' })
      .expect(200);
    const dev2 = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sv01@vnua.edu.vn', password: 'Password123' })
      .expect(200);

    // Sai mật khẩu hiện tại (US1-AS9)
    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${dev1.body.data.accessToken}`)
      .send({ currentPassword: 'WrongPassword1', newPassword: 'NewPassword123' })
      .expect(401);

    // Phiên dev2 vẫn hoạt động
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${dev2.body.data.accessToken}`)
      .expect(200);

    // Đổi mật khẩu thành công (US1-AS8 & US1-AS10)
    await request(app.getHttpServer())
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${dev1.body.data.accessToken}`)
      .send({ currentPassword: 'Password123', newPassword: 'NewPassword123' })
      .expect(200);

    // Cả access token và refresh token của dev1 & dev2 đều bị chặn ngay lập tức
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${dev1.body.data.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${dev2.body.data.accessToken}`)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: dev2.body.data.refreshToken })
      .expect(401);
  });

  it('US1-AS4, US1-AS12, US1-AS15: Google OAuth hợp nhất tài khoản cùng email, từ chối email chưa xác thực (401), và trả 503 khi Google lỗi', async () => {
    const spy = jest.spyOn(authService, 'verifyGoogleIdToken');

    // US1-AS12: email chưa xác thực
    spy.mockResolvedValueOnce({
      sub: 'google-sub-unverified',
      email: 'unverified@vnua.edu.vn',
      emailVerified: false,
      name: 'Unverified User',
      picture: null,
    });
    await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ idToken: 'mock-unverified-token' })
      .expect(401);

    // US1-AS4: hợp nhất vào tài khoản sv01@vnua.edu.vn đã tồn tại
    spy.mockResolvedValueOnce({
      sub: 'google-sub-sv01',
      email: 'sv01@vnua.edu.vn',
      emailVerified: true,
      name: 'Nguyễn Văn A',
      picture: 'https://example.com/avatar.png',
    });
    const merged = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ idToken: 'mock-valid-token' })
      .expect(200);
    expect(merged.body.data.user.email).toBe('sv01@vnua.edu.vn');

    const countRows = await dataSource.query(
      "SELECT COUNT(*)::int AS cnt FROM users WHERE email = 'sv01@vnua.edu.vn';",
    );
    expect(countRows[0].cnt).toBe(1);

    // US1-AS15: Google API tạm thời gián đoạn -> 503 không lộ nội bộ
    spy.mockRejectedValueOnce(new Error('GOOGLE_PROVIDER_UNAVAILABLE'));
    const unavailable = await request(app.getHttpServer())
      .post('/api/v1/auth/google')
      .send({ idToken: 'mock-network-err' })
      .expect(503);
    expect(unavailable.body.error.code).toBe('SERVICE_UNAVAILABLE');

    spy.mockRestore();
  });

  it('US1-AS5, US1-AS13, US1-AS14: Cập nhật hồ sơ, phân quyền Admin, phân trang /admin/users & /admin/audit-logs, khóa tài khoản 403 ACCOUNT_DISABLED', async () => {
    const loginLearner = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sv01@vnua.edu.vn', password: 'NewPassword123' })
      .expect(200);
    const learnerToken = loginLearner.body.data.accessToken;
    const learnerRefresh = loginLearner.body.data.refreshToken;
    const learnerId = loginLearner.body.data.user.id;

    // PATCH /users/me hợp lệ & kiểm tra validation avatarUrl
    await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({ avatarUrl: 'not-a-valid-url' })
      .expect(400);

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${learnerToken}`)
      .send({
        fullName: 'Nguyễn Văn Updated',
        avatarUrl: 'https://cdn.example.com/u1.png',
        targetLevel: 'B2',
        emailReminderEnabled: false,
      })
      .expect(200);
    expect(updated.body.data.fullName).toBe('Nguyễn Văn Updated');
    expect(updated.body.data.targetLevel).toBe('B2');
    expect(updated.body.data.emailReminderEnabled).toBe(false);

    // Học viên gọi API quản trị -> 403 FORBIDDEN (US1-AS14)
    await request(app.getHttpServer())
      .get('/api/v1/admin/users?page=1&limit=10')
      .set('Authorization', `Bearer ${learnerToken}`)
      .expect(403);

    // Tạo tài khoản admin
    const adminReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'admin@vnua.edu.vn',
        password: 'AdminPassword123',
        fullName: 'Quản Trị Viên',
      })
      .expect(201);
    await dataSource.query("UPDATE users SET role = 'admin' WHERE id = $1;", [
      adminReg.body.data.user.id,
    ]);
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@vnua.edu.vn', password: 'AdminPassword123' })
      .expect(200);
    const adminToken = adminLogin.body.data.accessToken;

    // Admin xem danh sách users & audit-logs phân trang
    const usersPage = await request(app.getHttpServer())
      .get('/api/v1/admin/users?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(usersPage.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(usersPage.body.data.items[0].passwordHash).toBeUndefined();

    const auditPage = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs?page=1&limit=20')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(auditPage.body.data.items.length).toBeGreaterThan(0);

    // Admin khóa mềm tài khoản học viên (US1-AS13)
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${learnerId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false })
      .expect(200);

    const lockedLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'sv01@vnua.edu.vn', password: 'NewPassword123' })
      .expect(403);
    expect(lockedLogin.body.error.code).toBe('ACCOUNT_DISABLED');

    const lockedRefresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: learnerRefresh })
      .expect(403);
    expect(lockedRefresh.body.error.code).toBe('ACCOUNT_DISABLED');
  });

  it('US1-AS11: Vượt ngưỡng đăng nhập thất bại trả 429 TOO_MANY_REQUESTS không tiết lộ tài khoản tồn tại', async () => {
    await redis.flushdb();
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'bruteforce@vnua.edu.vn', password: 'WrongPassword1' })
        .expect(401);
    }
    const blocked = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'bruteforce@vnua.edu.vn', password: 'WrongPassword1' })
      .expect(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});
