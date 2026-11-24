import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { AppModule, configureNestApp } from '../../src/app.module';
import { REDIS_CLIENT } from '../../src/config/redis.config';

describe('Quiz Generation & Smart Grading Integration Tests (US3)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redis: Redis;
  let tokenA: string;
  let tokenB: string;

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

    const regA = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'grading_a@vnua.edu.vn', password: 'Password123', fullName: 'Learner A' })
      .expect(201);
    tokenA = regA.body.data.accessToken;

    const regB = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'grading_b@vnua.edu.vn', password: 'Password123', fullName: 'Learner B' })
      .expect(201);
    tokenB = regB.body.data.accessToken;
  });

  afterAll(async () => {
    if (redis) await redis.quit().catch(() => {});
    if (app) await app.close();
  });

  it('Mixed quiz khi 0 từ đã học trả 400 INSUFFICIENT_STUDIED_WORDS; nộp trùng attempt trả 409 ATTEMPT_ALREADY_SUBMITTED; nộp attempt của người khác trả 403 FORBIDDEN; không tồn tại trả 404', async () => {
    // 0 từ đã học -> 400 INSUFFICIENT_STUDIED_WORDS
    const mixedEmpty = await request(app.getHttpServer())
      .post('/api/v1/learning/quizzes/mixed/start')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ totalQuestions: 10 })
      .expect(400);
    expect(mixedEmpty.body.error.code).toBe('INSUFFICIENT_STUDIED_WORDS');

    // Mở đủ thẻ bài 1 của A1 topic 1 cho Learner A
    const lessons = await dataSource.query(
      `SELECT id FROM lessons WHERE cefr_level = 'A1' AND topic_id = 1 ORDER BY order_index ASC LIMIT 1;`,
    );
    const lessonId = lessons[0].id;
    const vocabs = await dataSource.query(
      `SELECT vocabulary_id AS id FROM lesson_vocabularies WHERE lesson_id = $1 ORDER BY order_in_lesson ASC;`,
      [lessonId],
    );
    for (const v of vocabs) {
      await request(app.getHttpServer())
        .post(`/api/v1/learning/lessons/${lessonId}/cards/${v.id}/open`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
    }

    const started = await request(app.getHttpServer())
      .post(`/api/v1/learning/lessons/${lessonId}/practice/start`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);
    const attemptId = started.body.data.attemptId;

    // Đảm bảo không sinh câu hỏi dictation cho từ thiếu audio_url
    for (const q of started.body.data.questions) {
      if (q.practiceMode === 'dictation') {
        expect(q.audioUrl).toBeTruthy();
      }
      // Ẩn đáp án đúng khỏi payload trả về client
      expect(q.correctAnswer).toBeUndefined();
    }

    // Learner B cố nộp attempt của Learner A -> 403 FORBIDDEN
    await request(app.getHttpServer())
      .post(`/api/v1/learning/quizzes/${attemptId}/submit`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        answers: started.body.data.questions.map((q: { vocabularyId: number }) => ({
          vocabularyId: q.vocabularyId,
          userAnswer: 'x',
          responseTimeMs: 3000,
        })),
      })
      .expect(403);

    // Attempt không tồn tại -> 404
    await request(app.getHttpServer())
      .post('/api/v1/learning/quizzes/999999/submit')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ answers: [] })
      .expect(404);

    // Learner A nộp thành công lần 1
    const snapRows = await dataSource.query(
      'SELECT questions_snapshot FROM quiz_attempts WHERE id = $1;',
      [attemptId],
    );
    const answers = snapRows[0].questions_snapshot.map(
      (q: { vocabularyId: number; correctAnswer: string }) => ({
        vocabularyId: q.vocabularyId,
        userAnswer: q.correctAnswer,
        responseTimeMs: 3000,
      }),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/learning/quizzes/${attemptId}/submit`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ answers })
      .expect(200);

    // Nộp trùng lần 2 -> 409 ATTEMPT_ALREADY_SUBMITTED
    const dup = await request(app.getHttpServer())
      .post(`/api/v1/learning/quizzes/${attemptId}/submit`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ answers })
      .expect(409);
    expect(dup.body.error.code).toBe('ATTEMPT_ALREADY_SUBMITTED');

    // Sau khi đã học 1 bài, Mixed Quiz hoạt động được
    const mixedOk = await request(app.getHttpServer())
      .post('/api/v1/learning/quizzes/mixed/start')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ totalQuestions: 10 })
      .expect(201);
    expect(mixedOk.body.data.questions).toHaveLength(10);
  });
});
