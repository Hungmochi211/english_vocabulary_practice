import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule, configureNestApp } from '../../src/app.module';

describe('Lesson Detail API Integration Tests (US3)', () => {
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

  it('US3-AS1 & US3-AS2: Gửi GET /api/v1/lessons/1 -> trả về chi tiết bài học và danh sách từ vựng sắp xếp theo orderInLesson (1..N) đầy đủ các trường chuẩn', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/lessons/1').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.error).toBeNull();

    const { lesson, vocabularies } = res.body.data;
    expect(lesson.id).toBe(1);
    expect(vocabularies.length).toBeGreaterThanOrEqual(15);
    expect(vocabularies.length).toBeLessThanOrEqual(20);
    expect(vocabularies.length).toBe(lesson.wordCount);

    vocabularies.forEach((v: Record<string, unknown>, idx: number) => {
      expect(v.orderInLesson).toBe(idx + 1);
      expect(v).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          word: expect.any(String),
          cefrLevel: expect.any(String),
          partOfSpeech: expect.any(String),
          senseNumber: expect.any(Number),
          phonetic: expect.stringMatching(/^\/.+\/$/),
          vietnameseMeaning: expect.any(String),
          exampleEn: expect.any(String),
          exampleVi: expect.any(String),
          topicId: expect.any(Number),
        }),
      );
      expect('audioUrl' in v).toBe(true);
    });
  });

  it('US3-AS3: Gửi GET /api/v1/lessons/999999 -> trả về mã 404 Not Found với envelope LESSON_NOT_FOUND', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/lessons/999999').expect(404);
    expect(res.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'LESSON_NOT_FOUND',
        message: 'Bài học không tồn tại',
        details: null,
      },
    });
  });
});
