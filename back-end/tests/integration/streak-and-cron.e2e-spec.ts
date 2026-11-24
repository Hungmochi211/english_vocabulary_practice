import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { AppModule, configureNestApp } from '../../src/app.module';
import { REDIS_CLIENT } from '../../src/config/redis.config';
import { StreakService } from '../../src/modules/gamification/streak.service';
import { StreakReminderCron } from '../../src/modules/gamification/streak-reminder.cron';
import { getTodayUtc7Date, addDaysUtc7 } from '../../src/common/utils/timezone.util';

describe('Streak, Stats & 20:00 Cron Integration Tests (US5-AS1..US5-AS5)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let redis: Redis;
  let streakService: StreakService;
  let reminderCron: StreakReminderCron;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureNestApp(app);
    await app.init();

    dataSource = app.get(DataSource);
    redis = app.get<Redis>(REDIS_CLIENT);
    streakService = app.get(StreakService);
    reminderCron = app.get(StreakReminderCron);
    await redis.flushdb();

    await dataSource.query(
      'TRUNCATE TABLE audit_logs, daily_study_logs, user_streaks, user_sm2_reviews, quiz_attempt_answers, quiz_attempts, user_lesson_progress, refresh_sessions, users RESTART IDENTITY CASCADE;',
    );
  });

  afterAll(async () => {
    if (redis) await redis.quit().catch(() => {});
    if (app) await app.close();
  });

  async function createUser(email: string, fullName: string) {
    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'Password123', fullName })
      .expect(201);
    return {
      id: reg.body.data.user.id as number,
      token: reg.body.data.accessToken as string,
    };
  }

  it('US5-AS1 & A1: Bài dưới 80% không kích hoạt streak; bài >= 80% tăng streak từ 3->4 (longest giữ 5); bài thứ 2 cùng ngày không tăng trùng và cộng dồn nguyên tử bộ đếm ngày', async () => {
    const today = getTodayUtc7Date();
    const yesterday = addDaysUtc7(today, -1);
    const u = await createUser('streak1@vnua.edu.vn', 'Streak One');

    await dataSource.query(
      `UPDATE user_streaks SET current_streak = 3, longest_streak = 5, last_study_date = $1::date WHERE user_id = $2;`,
      [yesterday, u.id],
    );

    // Mở hết thẻ Bài 1
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
        .set('Authorization', `Bearer ${u.token}`)
        .expect(200);
    }

    // 1. Nộp bài dưới 80% (0%) -> KHÔNG kích hoạt streak
    const sFail = await request(app.getHttpServer())
      .post(`/api/v1/learning/lessons/${lessonId}/practice/start`)
      .set('Authorization', `Bearer ${u.token}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/learning/quizzes/${sFail.body.data.attemptId}/submit`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({
        answers: sFail.body.data.questions.map((q: { vocabularyId: number }) => ({
          vocabularyId: q.vocabularyId,
          userAnswer: '__wrong__',
          responseTimeMs: 4000,
        })),
      })
      .expect(200);

    const statsAfterFail = await request(app.getHttpServer())
      .get('/api/v1/stats/overview')
      .set('Authorization', `Bearer ${u.token}`)
      .expect(200);
    expect(statsAfterFail.body.data.currentStreak).toBe(3);

    // 2. Nộp bài đạt 100% (>= 80%) -> currentStreak = 4, longestStreak = 5
    const sPass1 = await request(app.getHttpServer())
      .post(`/api/v1/learning/lessons/${lessonId}/practice/start`)
      .set('Authorization', `Bearer ${u.token}`)
      .expect(201);
    const snap1 = (
      await dataSource.query('SELECT questions_snapshot FROM quiz_attempts WHERE id = $1;', [
        sPass1.body.data.attemptId,
      ])
    )[0].questions_snapshot;
    await request(app.getHttpServer())
      .post(`/api/v1/learning/quizzes/${sPass1.body.data.attemptId}/submit`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({
        answers: snap1.map((q: { vocabularyId: number; correctAnswer: string }) => ({
          vocabularyId: q.vocabularyId,
          userAnswer: q.correctAnswer,
          responseTimeMs: 3000,
        })),
      })
      .expect(200);

    // 3. Nộp đồng thời 2 lần bài đạt >= 80% trong cùng ngày -> streak vẫn là 4, lesson_practices_completed tăng đúng +2 (tổng = 3)
    const [sPass2, sPass3] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/learning/lessons/${lessonId}/practice/start`)
        .set('Authorization', `Bearer ${u.token}`)
        .expect(201),
      request(app.getHttpServer())
        .post(`/api/v1/learning/lessons/${lessonId}/practice/start`)
        .set('Authorization', `Bearer ${u.token}`)
        .expect(201),
    ]);
    const [snap2, snap3] = await Promise.all([
      dataSource.query('SELECT questions_snapshot FROM quiz_attempts WHERE id = $1;', [
        sPass2.body.data.attemptId,
      ]),
      dataSource.query('SELECT questions_snapshot FROM quiz_attempts WHERE id = $1;', [
        sPass3.body.data.attemptId,
      ]),
    ]);

    await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/learning/quizzes/${sPass2.body.data.attemptId}/submit`)
        .set('Authorization', `Bearer ${u.token}`)
        .send({
          answers: snap2[0].questions_snapshot.map(
            (q: { vocabularyId: number; correctAnswer: string }) => ({
              vocabularyId: q.vocabularyId,
              userAnswer: q.correctAnswer,
              responseTimeMs: 3000,
            }),
          ),
        })
        .expect(200),
      request(app.getHttpServer())
        .post(`/api/v1/learning/quizzes/${sPass3.body.data.attemptId}/submit`)
        .set('Authorization', `Bearer ${u.token}`)
        .send({
          answers: snap3[0].questions_snapshot.map(
            (q: { vocabularyId: number; correctAnswer: string }) => ({
              vocabularyId: q.vocabularyId,
              userAnswer: q.correctAnswer,
              responseTimeMs: 3000,
            }),
          ),
        })
        .expect(200),
    ]);

    const statsAfter = await request(app.getHttpServer())
      .get('/api/v1/stats/overview')
      .set('Authorization', `Bearer ${u.token}`)
      .expect(200);
    expect(statsAfter.body.data.currentStreak).toBe(4);
    expect(statsAfter.body.data.longestStreak).toBe(5);
    expect(statsAfter.body.data.last7Days).toHaveLength(7);

    const logRow = await dataSource.query(
      'SELECT lesson_practices_completed, streak_qualified FROM daily_study_logs WHERE user_id = $1 AND study_date = $2::date;',
      [u.id, today],
    );
    expect(logRow[0].lesson_practices_completed).toBe(3);
    expect(logRow[0].streak_qualified).toBe(true);
  });

  it('US5-AS2: Có 4 từ đến hạn (0 < total_due < 10) -> hoàn thành ôn hết cả 4 từ vẫn đạt streak ngày', async () => {
    const today = getTodayUtc7Date();
    const yesterday = addDaysUtc7(today, -1);
    const u = await createUser('streak_due4@vnua.edu.vn', 'Streak Due 4');

    await dataSource.query(
      `UPDATE user_streaks SET current_streak = 2, longest_streak = 2, last_study_date = $1::date WHERE user_id = $2;`,
      [yesterday, u.id],
    );

    const vocabs: Array<{ id: number }> = await dataSource.query(
      'SELECT id FROM vocabularies ORDER BY id ASC LIMIT 4;',
    );
    for (const v of vocabs) {
      await dataSource.query(
        `
        INSERT INTO user_sm2_reviews (user_id, vocabulary_id, easiness_factor, repetitions, interval_days, next_review_date, leitner_box)
        VALUES ($1, $2, 2.50, 0, 1, $3::date, 1);
        `,
        [u.id, v.id, today],
      );
    }

    const revStart = await request(app.getHttpServer())
      .post('/api/v1/reviews/session/start')
      .set('Authorization', `Bearer ${u.token}`)
      .send({ limit: 20 })
      .expect(201);
    const snap = (
      await dataSource.query('SELECT questions_snapshot FROM quiz_attempts WHERE id = $1;', [
        revStart.body.data.attemptId,
      ])
    )[0].questions_snapshot;

    const revSubmit = await request(app.getHttpServer())
      .post(`/api/v1/learning/quizzes/${revStart.body.data.attemptId}/submit`)
      .set('Authorization', `Bearer ${u.token}`)
      .send({
        answers: snap.map((q: { vocabularyId: number; correctAnswer: string }) => ({
          vocabularyId: q.vocabularyId,
          userAnswer: q.correctAnswer,
          responseTimeMs: 3000,
        })),
      })
      .expect(200);

    expect(revSubmit.body.data.streak.currentStreak).toBe(3);
    expect(revSubmit.body.data.streak.longestStreak).toBe(3);
  });

  it('US5-AS3 & Edge Case 2: Bỏ ngày D-1 (last_study_date = D-2) -> xem overview hiện 0; khi học lại đặt về 1 và giữ nguyên longestStreak=6', async () => {
    const today = getTodayUtc7Date();
    const twoDaysAgo = addDaysUtc7(today, -2);
    const u = await createUser('streak_reset@vnua.edu.vn', 'Streak Reset');

    await dataSource.query(
      `UPDATE user_streaks SET current_streak = 6, longest_streak = 6, last_study_date = $1::date WHERE user_id = $2;`,
      [twoDaysAgo, u.id],
    );

    // Edge Case 2: truy vấn trước khi học lại -> hiển thị 0 ngay
    const before = await request(app.getHttpServer())
      .get('/api/v1/stats/overview')
      .set('Authorization', `Bearer ${u.token}`)
      .expect(200);
    expect(before.body.data.currentStreak).toBe(0);
    expect(before.body.data.longestStreak).toBe(6);

    // Ghi nhận hoàn thành bài học hôm nay -> reset currentStreak = 1, giữ longestStreak = 6
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const res = await streakService.recordDailyProgressAndUpdateStreak(qr, {
        userId: u.id,
        studyDate: today,
        attemptType: 'lesson_practice',
        passedLesson: true,
        wordsLearnedDelta: 15,
        wordsReviewedDelta: 0,
      });
      await qr.commitTransaction();
      expect(res.currentStreak).toBe(1);
      expect(res.longestStreak).toBe(6);
    } finally {
      await qr.release();
    }
  });

  it('US5-AS4 & US5-AS5: Cron quét 20:00 chỉ enqueue đúng Học viên A (streak>=1, last_study_date=hôm qua, bật email); chạy lần 2 cùng ngày không gửi trùng', async () => {
    const today = getTodayUtc7Date();
    const yesterday = addDaysUtc7(today, -1);

    await dataSource.query(
      'TRUNCATE TABLE daily_study_logs, user_streaks, refresh_sessions, users RESTART IDENTITY CASCADE;',
    );

    const userA = await createUser('a_warn@vnua.edu.vn', 'Học viên A');
    const userB = await createUser('b_done@vnua.edu.vn', 'Học viên B');
    const userC = await createUser('c_zero@vnua.edu.vn', 'Học viên C');
    const userD = await createUser('d_optout@vnua.edu.vn', 'Học viên D');

    await dataSource.query(
      `UPDATE user_streaks SET current_streak = 5, longest_streak = 5, last_study_date = $1::date WHERE user_id = $2;`,
      [yesterday, userA.id],
    );
    await dataSource.query(
      `UPDATE user_streaks SET current_streak = 5, longest_streak = 5, last_study_date = $1::date WHERE user_id = $2;`,
      [today, userB.id],
    );
    // userC giữ current_streak = 0
    await dataSource.query(
      `UPDATE user_streaks SET current_streak = 3, longest_streak = 3, last_study_date = $1::date WHERE user_id = $2;`,
      [yesterday, userD.id],
    );
    await dataSource.query(
      `UPDATE users SET email_reminder_enabled = FALSE WHERE id = $1;`,
      [userD.id],
    );

    // Lần quét 1: chỉ enqueue đúng Học viên A
    const run1 = await reminderCron.scanAndEnqueueReminders(today);
    expect(run1.enqueuedUserIds).toEqual([userA.id]);

    // Lần quét 2 cùng ngày (US5-AS5): 0 email gửi trùng
    const run2 = await reminderCron.scanAndEnqueueReminders(today);
    expect(run2.enqueuedUserIds).toEqual([]);

    const logA = await dataSource.query(
      'SELECT reminder_sent, reminder_status FROM daily_study_logs WHERE user_id = $1 AND study_date = $2::date;',
      [userA.id, today],
    );
    expect(logA[0].reminder_sent).toBe(true);
    expect(['queued', 'delivered', 'failed']).toContain(logA[0].reminder_status);
  });
});
