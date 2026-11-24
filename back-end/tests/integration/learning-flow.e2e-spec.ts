import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { AppModule, configureNestApp } from '../../src/app.module';
import { REDIS_CLIENT } from '../../src/config/redis.config';

describe('2-Step Learning & Unlock Gate Integration Tests (US2-AS1..US2-AS6)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redis: Redis;
  let accessToken: string;
  let lesson1Id: number;
  let lesson2Id: number;
  let lesson1Vocabs: Array<{ id: number; word: string }>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureNestApp(app);
    await app.init();

    dataSource = app.get(DataSource);
    redis = app.get<Redis>(REDIS_CLIENT);
    await redis.flushdb();

    await dataSource.query(
      'TRUNCATE TABLE audit_logs, daily_study_logs, user_streaks, user_sm2_reviews, quiz_attempt_answers, quiz_attempts, user_lesson_progress, refresh_sessions, users RESTART IDENTITY CASCADE;',
    );

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'learner_us2@vnua.edu.vn',
        password: 'Password123',
        fullName: 'Học Viên US2',
      })
      .expect(201);
    accessToken = reg.body.data.accessToken;

    const lessons = await dataSource.query(
      `SELECT id, order_index FROM lessons WHERE cefr_level = 'A1' AND topic_id = 1 ORDER BY order_index ASC LIMIT 2;`,
    );
    lesson1Id = lessons[0].id;
    lesson2Id = lessons[1].id;

    lesson1Vocabs = await dataSource.query(
      `
      SELECT v.id, v.word
      FROM lesson_vocabularies lv
      INNER JOIN vocabularies v ON v.id = lv.vocabulary_id
      WHERE lv.lesson_id = $1
      ORDER BY lv.order_in_lesson ASC;
      `,
      [lesson1Id],
    );
  });

  afterAll(async () => {
    process.env.STRICT_UNLOCK_MODE = 'true';
    if (redis) await redis.quit().catch(() => {});
    if (app) await app.close();
  });

  it('US2-AS1: Tài khoản mới có tất cả Bài 1 (orderIndex=1) mở sẵn, Bài >= 2 đang khóa', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/learning/lessons?level=A1')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const items = res.body.data;
    expect(items.length).toBeGreaterThan(8);
    for (const l of items) {
      if (l.orderIndex === 1) {
        expect(l.isUnlocked).toBe(true);
      } else {
        expect(l.isUnlocked).toBe(false);
      }
    }
  });

  it('US2-AS2 & US2-AS3: Chặn practice/start khi chưa mở hết thẻ (403 ACQUISITION_REQUIRED), chặn mở thẻ không thuộc bài học (404), và chặn Bài 2 khi đang khóa', async () => {
    // Chưa mở thẻ nào -> bị chặn
    const blocked = await request(app.getHttpServer())
      .post(`/api/v1/learning/lessons/${lesson1Id}/practice/start`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
    expect(blocked.body.error.code).toBe('ACQUISITION_REQUIRED');

    // Mở từ không thuộc lesson1 -> 404
    await request(app.getHttpServer())
      .post(`/api/v1/learning/lessons/${lesson1Id}/cards/999999/open`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);

    // Chặn truy cập Bài 2 khi Bài 1 chưa đạt >= 80%
    const locked2 = await request(app.getHttpServer())
      .post(`/api/v1/learning/lessons/${lesson2Id}/practice/start`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
    expect(locked2.body.error.code).toBe('LESSON_LOCKED');
  });

  it('US2-AS4 & US2-AS5: Mở hết thẻ Bài 1 -> làm bài dưới 80% (Bài 2 vẫn khóa, vẫn cập nhật SM-2) -> làm lại >= 80% (mở khóa Bài 2) -> làm lại điểm thấp hơn vẫn giữ isCompleted & bestScore', async () => {
    // Mở đủ 100% thẻ Bài 1
    let lastOpenRes: request.Response | undefined;
    for (const v of lesson1Vocabs) {
      lastOpenRes = await request(app.getHttpServer())
        .post(`/api/v1/learning/lessons/${lesson1Id}/cards/${v.id}/open`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    }
    expect(lastOpenRes!.body.data.acquisitionCompleted).toBe(true);

    // Lần 1: Làm bài đạt ~50% (< 80%)
    const start1 = await request(app.getHttpServer())
      .post(`/api/v1/learning/lessons/${lesson1Id}/practice/start`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    const attempt1Id = start1.body.data.attemptId;
    const questions1 = start1.body.data.questions;

    const answers1 = questions1.map((q: { vocabularyId: number }, idx: number) => ({
      vocabularyId: q.vocabularyId,
      userAnswer: idx < Math.floor(questions1.length / 2) ? '__WRONG__' : '__WRONG__',
      responseTimeMs: 4000,
    }));
    const submit1 = await request(app.getHttpServer())
      .post(`/api/v1/learning/quizzes/${attempt1Id}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ answers: answers1 })
      .expect(200);

    expect(submit1.body.data.passed).toBe(false);
    expect(submit1.body.data.nextLessonUnlocked).toBe(false);

    // SM-2 vẫn được cập nhật cho tất cả từ đã nộp dù trượt
    const sm2Count = await dataSource.query('SELECT COUNT(*)::int AS cnt FROM user_sm2_reviews;');
    expect(sm2Count[0].cnt).toBe(lesson1Vocabs.length);

    // Lần 2: Làm lại KHÔNG cần mở lại thẻ -> trả lời đúng hết (>= 80%)
    const start2 = await request(app.getHttpServer())
      .post(`/api/v1/learning/lessons/${lesson1Id}/practice/start`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    const attempt2Id = start2.body.data.attemptId;
    const snapRows = await dataSource.query(
      'SELECT questions_snapshot FROM quiz_attempts WHERE id = $1;',
      [attempt2Id],
    );
    const snapshot2 = snapRows[0].questions_snapshot;
    const answers2 = snapshot2.map((q: { vocabularyId: number; correctAnswer: string }) => ({
      vocabularyId: q.vocabularyId,
      userAnswer: q.correctAnswer,
      responseTimeMs: 3500,
    }));
    const submit2 = await request(app.getHttpServer())
      .post(`/api/v1/learning/quizzes/${attempt2Id}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ answers: answers2 })
      .expect(200);

    expect(submit2.body.data.scorePercentage).toBe(100);
    expect(submit2.body.data.passed).toBe(true);
    expect(submit2.body.data.nextLessonUnlocked).toBe(true);

    // Kiểm tra Bài 2 đã mở khóa
    const listAfter = await request(app.getHttpServer())
      .get('/api/v1/learning/lessons?level=A1&topicId=1')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const l2 = listAfter.body.data.find((x: { id: number }) => x.id === lesson2Id);
    expect(l2.isUnlocked).toBe(true);

    // Lần 3: Làm lại Bài 1 bị 0% -> isCompleted vẫn true & bestScore vẫn 100
    const start3 = await request(app.getHttpServer())
      .post(`/api/v1/learning/lessons/${lesson1Id}/practice/start`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);
    const answers3 = start3.body.data.questions.map((q: { vocabularyId: number }) => ({
      vocabularyId: q.vocabularyId,
      userAnswer: 'completely_wrong',
      responseTimeMs: 4000,
    }));
    await request(app.getHttpServer())
      .post(`/api/v1/learning/quizzes/${start3.body.data.attemptId}/submit`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ answers: answers3 })
      .expect(200);

    const listRetake = await request(app.getHttpServer())
      .get('/api/v1/learning/lessons?level=A1&topicId=1')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const l1 = listRetake.body.data.find((x: { id: number }) => x.id === lesson1Id);
    expect(l1.isCompleted).toBe(true);
    expect(Number(l1.bestScore)).toBe(100);
  });

  it('US2-AS6: STRICT_UNLOCK_MODE=false cho phép bỏ qua cổng khóa bài', async () => {
    process.env.STRICT_UNLOCK_MODE = 'false';
    const listBypass = await request(app.getHttpServer())
      .get('/api/v1/learning/lessons?level=B2')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    for (const l of listBypass.body.data) {
      expect(l.isUnlocked).toBe(true);
    }
    process.env.STRICT_UNLOCK_MODE = 'true';
  });
});
