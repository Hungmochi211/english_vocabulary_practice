import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { AppModule, configureNestApp } from '../../src/app.module';
import { REDIS_CLIENT } from '../../src/config/redis.config';
import { ReviewService } from '../../src/modules/review/review.service';
import { getTodayUtc7Date, addDaysUtc7 } from '../../src/common/utils/timezone.util';

describe('SM-2 & Review API Integration Tests (US4-AS6..US4-AS7)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redis: Redis;
  let reviewService: ReviewService;
  let token: string;
  let userId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureNestApp(app);
    await app.init();

    dataSource = app.get(DataSource);
    redis = app.get<Redis>(REDIS_CLIENT);
    reviewService = app.get(ReviewService);
    await redis.flushdb();

    await dataSource.query(
      'TRUNCATE TABLE audit_logs, daily_study_logs, user_streaks, user_sm2_reviews, quiz_attempt_answers, quiz_attempts, user_lesson_progress, refresh_sessions, users RESTART IDENTITY CASCADE;',
    );

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'sm2_user@vnua.edu.vn', password: 'Password123', fullName: 'SM2 Learner' })
      .expect(201);
    token = reg.body.data.accessToken;
    userId = reg.body.data.user.id;
  });

  afterAll(async () => {
    if (redis) await redis.quit().catch(() => {});
    if (app) await app.close();
  });

  it('Trạng thái rỗng: GET /reviews/due trả [] và totalDue=0; POST /reviews/session/start trả 400 NO_DUE_REVIEWS', async () => {
    const emptyDue = await request(app.getHttpServer())
      .get('/api/v1/reviews/due?limit=20')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(emptyDue.body.data.totalDue).toBe(0);
    expect(emptyDue.body.data.items).toEqual([]);

    const noStart = await request(app.getHttpServer())
      .post('/api/v1/reviews/session/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ limit: 20 })
      .expect(400);
    expect(noStart.body.error.code).toBe('NO_DUE_REVIEWS');
  });

  it('US4-AS6: Có 25 từ đến hạn -> GET /reviews/due?limit=20 trả 20 từ sắp theo leitnerBox ASC, nextReviewDate ASC, id ASC kèm totalDue=25', async () => {
    const today = getTodayUtc7Date();
    const yesterday = addDaysUtc7(today, -1);
    const tomorrow = addDaysUtc7(today, 1);

    const vocabs: Array<{ id: number }> = await dataSource.query(
      'SELECT id FROM vocabularies ORDER BY id ASC LIMIT 30;',
    );

    // 25 từ đến hạn (gồm box 1 và box 2), 5 từ chưa đến hạn (tomorrow)
    for (let i = 0; i < 25; i++) {
      const rep = i < 10 ? 1 : 0; // box 2 cho 10 từ đầu, box 1 cho 15 từ sau
      const box = rep === 0 ? 1 : 2;
      const dueDate = i % 2 === 0 ? yesterday : today;
      await dataSource.query(
        `
        INSERT INTO user_sm2_reviews (user_id, vocabulary_id, easiness_factor, repetitions, interval_days, next_review_date, leitner_box, last_quality_rating, last_reviewed_at)
        VALUES ($1, $2, 2.50, $3, 1, $4::date, $5, 4, NOW());
        `,
        [userId, vocabs[i].id, rep, dueDate, box],
      );
    }
    for (let i = 25; i < 30; i++) {
      await dataSource.query(
        `
        INSERT INTO user_sm2_reviews (user_id, vocabulary_id, easiness_factor, repetitions, interval_days, next_review_date, leitner_box, last_quality_rating, last_reviewed_at)
        VALUES ($1, $2, 2.50, 1, 1, $3::date, 2, 4, NOW());
        `,
        [userId, vocabs[i].id, tomorrow],
      );
    }

    const res = await request(app.getHttpServer())
      .get('/api/v1/reviews/due?limit=20')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data.totalDue).toBe(25);
    expect(res.body.data.items).toHaveLength(20);
    // 15 từ box 1 phải đứng trước 5 từ box 2
    for (let i = 0; i < 15; i++) {
      expect(res.body.data.items[i].leitnerBox).toBe(1);
    }
    for (let i = 15; i < 20; i++) {
      expect(res.body.data.items[i].leitnerBox).toBe(2);
    }

    const session = await request(app.getHttpServer())
      .post('/api/v1/reviews/session/start')
      .set('Authorization', `Bearer ${token}`)
      .send({ limit: 10 })
      .expect(201);
    expect(session.body.data.attemptId).toBeDefined();
    expect(session.body.data.questions).toHaveLength(10);
  });

  it('US4-AS7: Nộp đồng thời 2 kết quả (q=4 rồi q=5) cho cùng (user_id, vocabulary_id) -> áp dụng tuần tự đúng 1 lần -> EF=2.60, n=2, I=6, Hộp 3', async () => {
    const vocabs: Array<{ id: number }> = await dataSource.query(
      'SELECT id FROM vocabularies ORDER BY id DESC LIMIT 1;',
    );
    const vocabId = vocabs[0].id;
    const today = getTodayUtc7Date();

    const runOne = async (q: 0 | 1 | 2 | 3 | 4 | 5) => {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        await reviewService.applySm2UpdatesInTransaction(
          qr,
          userId,
          [{ vocabularyId: vocabId, qualityRating: q }],
          today,
        );
        await qr.commitTransaction();
      } catch (err) {
        await qr.rollbackTransaction();
        throw err;
      } finally {
        await qr.release();
      }
    };

    // Chạy đồng thời (Promise.all) 2 transaction cho cùng (userId, vocabId)
    await Promise.all([runOne(4), runOne(5)]);

    const rows = await dataSource.query(
      'SELECT easiness_factor, repetitions, interval_days, leitner_box FROM user_sm2_reviews WHERE user_id = $1 AND vocabulary_id = $2;',
      [userId, vocabId],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].easiness_factor)).toBe(2.6);
    expect(rows[0].repetitions).toBe(2);
    expect(rows[0].interval_days).toBe(6);
    expect(rows[0].leitner_box).toBe(3);
  });
});
