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
});
