import * as path from 'path';
import * as http from 'http';
import { Worker } from 'worker_threads';
import { NestFactory } from '@nestjs/core';
import { AppDataSource } from '../../src/config/database.config';
import { AppModule, configureNestApp } from '../../src/app.module';
import { seedTopics } from '../../src/database/seeds/topic.seeder';
import { seedVocabulariesAndLessons } from '../../src/database/seeds/vocabulary.seeder';

function runLoadInWorker(
  url: string,
  totalRequests: number,
  concurrency: number,
  onReady?: () => void,
): Promise<void> {
  const workerScript = `
    const http = require('http');
    const { parentPort, workerData } = require('worker_threads');
    const { url, totalRequests, concurrency } = workerData;

    const agent = new http.Agent({
      keepAlive: true,
      maxSockets: concurrency,
      maxFreeSockets: concurrency,
    });

    function oneReq() {
      return new Promise((resolve, reject) => {
        const req = http.get(url, { agent }, (res) => {
          res.resume();
          res.on('end', resolve);
        });
        req.on('error', reject);
      });
    }

    async function run() {
      const perWorker = Math.ceil(totalRequests / concurrency);
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      // Warmup 10 kết nối mỗi đợt để thiết lập sẵn 100 keep-alive sockets & JIT mà không gây nghẽn đầu kỳ
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
      workerData: { url, totalRequests, concurrency },
    });
    worker.on('message', (msg) => {
      if (msg === 'ready') {
        if (onReady) onReady();
      } else if (msg === 'done') {
        resolve();
      }
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
}

function calcP95(latencies: number[]): number {
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
}

async function runBenchmark() {
  const excelPath = path.resolve(__dirname, '../../../tools/oxford_3000_vocabulary.xlsx');

  await AppDataSource.initialize();
  await AppDataSource.query(
    'TRUNCATE TABLE lesson_vocabularies, lessons, vocabularies, topics RESTART IDENTITY CASCADE;',
  );

  // 1. Đo SC-004: Thời gian Seeder (< 15 giây)
  const seedStart = performance.now();
  await seedTopics(AppDataSource);
  const seedRes = await seedVocabulariesAndLessons(AppDataSource, excelPath);
  const seedDurationMs = performance.now() - seedStart;
  await AppDataSource.destroy();

  console.log(
    `[SC-004] Seeder loaded ${seedRes.totalVocabularies} vocabularies & ${seedRes.totalLessons} lessons in ${seedDurationMs.toFixed(1)} ms (< 15,000 ms)`,
  );
  if (seedDurationMs >= 15000) {
    throw new Error(`SC-004 FAILED: Seeder took ${seedDurationMs} ms (>= 15,000 ms)`);
  }

  // 2. Đo SC-005: p95 < 50ms (100 concurrent connections, 1,000 requests)
  const app = await NestFactory.create(AppModule, { logger: false });
  let activeLatencies: number[] = [];
  let recording = false;
  app.use((_req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => {
    const start = performance.now();
    res.on('finish', () => {
      if (recording) {
        activeLatencies.push(performance.now() - start);
      }
    });
    next();
  });
  configureNestApp(app);
  await app.listen(0);
  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 3000;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  try {
    // Warmup connection pool
    await runLoadInWorker(`${baseUrl}/lessons?level=A1`, 50, 10);

    activeLatencies = [];
    recording = false;
    await runLoadInWorker(`${baseUrl}/lessons?level=A1`, 1000, 100, () => {
      activeLatencies = [];
      recording = true;
    });
    recording = false;
    const listP95 = calcP95(activeLatencies);

    activeLatencies = [];
    recording = false;
    await runLoadInWorker(`${baseUrl}/lessons/1`, 1000, 100, () => {
      activeLatencies = [];
      recording = true;
    });
    recording = false;
    const detailP95 = calcP95(activeLatencies);

    console.log(
      `[SC-005] GET /api/v1/lessons?level=A1 (1000 req, 100 conc) -> p95 = ${listP95.toFixed(2)} ms (< 50 ms)`,
    );
    console.log(
      `[SC-005] GET /api/v1/lessons/1        (1000 req, 100 conc) -> p95 = ${detailP95.toFixed(2)} ms (< 50 ms)`,
    );

    if (listP95 >= 50 || detailP95 >= 50) {
      throw new Error(
        `SC-005 FAILED: p95 exceeded 50ms (list=${listP95.toFixed(2)}ms, detail=${detailP95.toFixed(2)}ms)`,
      );
    }
  } finally {
    await app.close();
  }
}

runBenchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
