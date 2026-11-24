import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule, configureNestApp } from '../../src/app.module';

describe('Topics & Lessons List API Integration Tests (US2)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureNestApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('Test GET /api/v1/topics: trả về 16 chủ đề chuẩn kèm totalLessons', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/topics').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(16);
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        code: expect.any(String),
        name: expect.any(String),
        nameVi: expect.any(String),
        totalLessons: expect.any(Number),
      }),
    );
    expect(res.body.data[0].totalLessons).toBeGreaterThan(0);
  });

  it('US2-AS1: Gửi GET /api/v1/lessons?level=A1 -> trả về danh sách bài học thuộc A1', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/lessons?level=A1').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const lesson of res.body.data) {
      expect(lesson.cefrLevel).toBe('A1');
    }
  });

  it('US2-AS2: Gửi GET /api/v1/lessons?level=B1&topicId=2 -> chỉ trả về bài học thuộc B1 và topicId=2', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/lessons?level=B1&topicId=2')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const lesson of res.body.data) {
      expect(lesson.cefrLevel).toBe('B1');
      expect(lesson.topicId).toBe(2);
    }
  });

  it('US2-AS3: Kiểm tra payload bài học có đủ title, wordCount (15-20), cefrLevel, orderIndex', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/lessons?level=A1').expect(200);
    const first = res.body.data[0];
    expect(first).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        topicId: expect.any(Number),
        topicNameVi: expect.any(String),
        cefrLevel: 'A1',
        title: expect.any(String),
        orderIndex: expect.any(Number),
        wordCount: expect.any(Number),
      }),
    );
    expect(first.wordCount).toBeGreaterThanOrEqual(15);
    expect(first.wordCount).toBeLessThanOrEqual(20);
  });

  it('Test Validation Error: Gửi GET /api/v1/lessons?level=INVALID hoặc topicId=-5 -> trả về mã 400 Bad Request với code: VALIDATION_ERROR và details chứa danh sách lỗi cụ thể', async () => {
    const res1 = await request(app.getHttpServer())
      .get('/api/v1/lessons?level=INVALID')
      .expect(400);
    expect(res1.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dữ liệu gửi lên không hợp lệ',
        details: expect.any(Array),
      },
    });
    expect(res1.body.error.details.length).toBeGreaterThan(0);

    const res2 = await request(app.getHttpServer())
      .get('/api/v1/lessons?topicId=-5')
      .expect(400);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res2.body.error.details)).toBe(true);
  });
});
