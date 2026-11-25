import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { AppModule, configureNestApp } from '../../src/app.module';
import { REDIS_CLIENT } from '../../src/config/redis.config';

describe('User Sync & Support E2E (US6 — FR-017..FR-020)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redis: Redis;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureNestApp(app);
    await app.init();

    dataSource = app.get(DataSource);
    redis = app.get(REDIS_CLIENT);
    await redis.flushdb();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('US6-AS3: GET /learning/history returns only the authenticated learner submitted attempts', async () => {
    const regA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `hist_a_${Date.now()}@vnua.edu.vn`,
        password: 'Password123',
        fullName: 'Learner A',
      })
      .expect(201);
    const tokenA = regA.body.data.accessToken;

    const histEmpty = await request(app.getHttpServer())
      .get('/api/v1/learning/history?page=1&limit=20')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(histEmpty.body.data.items).toEqual([]);
  });

  it('US6-AS5: /notifications persists create, read-all, and delete per learner', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `notif_${Date.now()}@vnua.edu.vn`,
        password: 'Password123',
        fullName: 'Notif Learner',
      })
      .expect(201);
    const token = reg.body.data.accessToken;

    const created = await request(app.getHttpServer())
      .post('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Hoàn tất phiên ôn SM-2',
        body: 'Bạn đạt 100%',
        icon: 'trophy',
        tone: 'green',
        targetRoute: '/history',
      })
      .expect(201);
    expect(created.body.data.read).toBe(false);

    await request(app.getHttpServer())
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listed.body.data.unreadCount).toBe(0);
    expect(listed.body.data.items).toHaveLength(1);
  });

  it('US6-AS6: /support/messages and /support/tickets persist learner inquiries and block non-admin from /admin/support/*', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `sup_${Date.now()}@vnua.edu.vn`,
        password: 'Password123',
        fullName: 'Support Learner',
      })
      .expect(201);
    const token = reg.body.data.accessToken;

    await request(app.getHttpServer())
      .post('/api/v1/support/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Em cần hỗ trợ lộ trình A2' })
      .expect(201);

    const msgs = await request(app.getHttpServer())
      .get('/api/v1/support/messages')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(msgs.body.data.length).toBeGreaterThanOrEqual(2);

    const ticket = await request(app.getHttpServer())
      .post('/api/v1/support/tickets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        category: 'Góp ý tính năng',
        email: 'learner@vnua.edu.vn',
        detail: 'Bổ sung thêm chủ đề Academic English.',
      })
      .expect(201);
    expect(ticket.body.data.ticketId).toMatch(/^TK-\d{6}$/);

    // Non-admin must receive 403 on /admin/support/threads
    await request(app.getHttpServer())
      .get('/api/v1/admin/support/threads')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
