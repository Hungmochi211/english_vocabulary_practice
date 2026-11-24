import * as http from 'http';
import { Worker } from 'worker_threads';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule, configureNestApp } from '../../src/app.module';
import { StreakReminderCron } from '../../src/modules/gamification/streak-reminder.cron';
import { getTodayUtc7Date, addDaysUtc7 } from '../../src/common/utils/timezone.util';

function calcP95(latencies: number[]): number {
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
}

function runAuthedGetLoadInWorker(
  url: string,
  bearerToken: string,
  totalRequests: number,
  concurrency: number,
  onReady: () => void,
): Promise<void> {
  const workerScript = `
    const http = require('http');
    const { parentPort, workerData } = require('worker_threads');
    const { url, bearerToken, totalRequests, concurrency } = workerData;

    const agent = new http.Agent({
      keepAlive: true,
      maxSockets: concurrency,
      maxFreeSockets: concurrency,
    });

    function oneReq() {
      return new Promise((resolve, reject) => {
        const req = http.get(url, { agent, headers: { Authorization: 'Bearer ' + bearerToken } }, (res) => {
          res.resume();
          res.on('end', resolve);
        });
        req.on('error', reject);
      });
    }

    async function run() {
      const perWorker = Math.ceil(totalRequests / concurrency);
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      for (let w = 0; w < concurrency; w += 10) {
        await Promise.all(Array.from({ length: 10 }, () => oneReq()));
      }
      await sleep(32);
      parentPort.postMessage('ready');

      const workers = Array.from({ length: concurrency }, async (_, idx) => {
        await sleep((idx % 10) * 16);
        for (let i = 0; i < perWorker; i++) {
          await oneReq();
          await sleep(160);
        }
      });
      await Promise.all(workers);
      agent.destroy();
      parentPort.postMessage('done');
    }
    run().catch((err) => { throw err; });
  `;

  return new Promise((resolve, reject) => {
    const worker = new Worker(workerScript, {
      eval: true,
      workerData: { url, bearerToken, totalRequests, concurrency },
    });
    worker.on('message', (msg) => {
      if (msg === 'ready') onReady();
      else if (msg === 'done') resolve();
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

async function runBenchmark() {
  const app = await NestFactory.create(AppModule, { logger: false });
  let latencies: number[] = [];
  let recording = false;

  app.use((_req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => {
    const start = performance.now();
    res.on('finish', () => {
      if (recording) latencies.push(performance.now() - start);
    });
    next();
  });

  configureNestApp(app);
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  const dataSource = app.get(DataSource);
  const reminderCron = app.get(StreakReminderCron);

  try {
    await dataSource.query(
      'TRUNCATE TABLE audit_logs, daily_study_logs, user_streaks, user_sm2_reviews, quiz_attempt_answers, quiz_attempts, user_lesson_progress, refresh_sessions, users RESTART IDENTITY CASCADE;',
    );

    // 1. Ghi nhận thời gian chuỗi API SC-001 (đăng ký + tải bài + mở thẻ đầu tiên)
    const sc001Start = performance.now();
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'bench_sc006@vnua.edu.vn',
        password: 'Password123',
        fullName: 'Bench Learner',
      }),
    });
    const regJson = (await regRes.json()) as { data: { accessToken: string; user: { id: number } } };
    const token = regJson.data.accessToken;

    const lessonsRes = await fetch(`${baseUrl}/learning/lessons?level=A1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const lessonsJson = (await lessonsRes.json()) as { data: Array<{ id: number }> };
    const firstLessonId = lessonsJson.data[0].id;
    const firstVocab = await dataSource.query(
      'SELECT vocabulary_id AS id FROM lesson_vocabularies WHERE lesson_id = $1 ORDER BY order_in_lesson ASC LIMIT 1;',
      [firstLessonId],
    );
    await fetch(`${baseUrl}/learning/lessons/${firstLessonId}/cards/${firstVocab[0].id}/open`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const sc001Ms = performance.now() - sc001Start;
    console.log(`[SC-001] Register + Load Lessons + Open First Card API chain = ${sc001Ms.toFixed(1)} ms`);

    // 2. Đo SC-006: p95 < 200ms trên GET /reviews/due với 100 kết nối đồng thời, 1.000 requests
    latencies = [];
    recording = false;
    await runAuthedGetLoadInWorker(`${baseUrl}/reviews/due?limit=20`, token, 1000, 100, () => {
      latencies = [];
      recording = true;
    });
    recording = false;
    const dueP95 = calcP95(latencies);
    console.log(`[SC-006] GET /api/v1/reviews/due (1000 req, 100 conc) -> p95 = ${dueP95.toFixed(2)} ms (< 200 ms)`);
    if (dueP95 >= 200) {
      throw new Error(`SC-006 FAILED: p95 = ${dueP95.toFixed(2)} ms (>= 200 ms)`);
    }

    // 3. Đo SC-007: Quét 10.000 hồ sơ người học & xếp hàng BullMQ (< 30 giây)
    const today = getTodayUtc7Date();
    const yesterday = addDaysUtc7(today, -1);
    await dataSource.query(`
      INSERT INTO users (email, password_hash, full_name, role, auth_provider, email_reminder_enabled, is_active)
      SELECT 'bulk_user_' || g || '@vnua.edu.vn', '$2b$10$placeholderhashplaceholderhashpl', 'User ' || g, 'learner', 'local', (g % 2 = 0), TRUE
      FROM generate_series(1, 10000) AS g;
    `);
    await dataSource.query(
      `
      INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_study_date)
      SELECT id, CASE WHEN id % 3 = 0 THEN 4 ELSE 0 END, CASE WHEN id % 3 = 0 THEN 4 ELSE 0 END,
             CASE WHEN id % 3 = 0 THEN $1::date ELSE NULL END
      FROM users
      WHERE email LIKE 'bulk_user_%';
      `,
      [yesterday],
    );

    const scanRes = await reminderCron.scanAndEnqueueReminders(today);
    console.log(
      `[SC-007] Scanned 10,000 profiles (enqueued ${scanRes.enqueuedUserIds.length} jobs) in ${scanRes.durationMs} ms (< 30,000 ms)`,
    );
    if (scanRes.durationMs >= 30000) {
      throw new Error(`SC-007 FAILED: scan took ${scanRes.durationMs} ms (>= 30,000 ms)`);
    }

    // Dọn sạch 10.000 user giả lập sau benchmark
    await dataSource.query(
      'TRUNCATE TABLE audit_logs, daily_study_logs, user_streaks, user_sm2_reviews, quiz_attempt_answers, quiz_attempts, user_lesson_progress, refresh_sessions, users RESTART IDENTITY CASCADE;',
    );
  } finally {
    await app.close();
  }
}

runBenchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
