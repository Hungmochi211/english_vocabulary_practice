import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule, configureNestApp } from '../../src/app.module';

describe('Vocabulary Search & Detail API Integration Tests (US4)', () => {
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

  it('US4-AS1: Tra cứu GET /api/v1/vocabularies/search?q=close và q=rock -> trả về đầy đủ các loại từ/cấp độ và sense_number 1, 2 theo thứ tự tất định', async () => {
    const closeRes = await request(app.getHttpServer())
      .get('/api/v1/vocabularies/search?q=close')
      .expect(200);
    expect(closeRes.body.success).toBe(true);
    const exactClose = closeRes.body.data.filter(
      (v: { word: string }) => v.word === 'close',
    );
    expect(exactClose.length).toBeGreaterThanOrEqual(2);
    const hasA2Adj = exactClose.some(
      (v: { cefrLevel: string; partOfSpeech: string }) =>
        v.cefrLevel === 'A2' && v.partOfSpeech === 'adj.',
    );
    const hasB2Noun = exactClose.some(
      (v: { cefrLevel: string; partOfSpeech: string }) =>
        v.cefrLevel === 'B2' && v.partOfSpeech === 'n.',
    );
    expect(hasA2Adj).toBe(true);
    expect(hasB2Noun).toBe(true);

    const rockRes = await request(app.getHttpServer())
      .get('/api/v1/vocabularies/search?q=rock')
      .expect(200);
    const rockA2Nouns = rockRes.body.data.filter(
      (v: { word: string; cefrLevel: string; partOfSpeech: string }) =>
        v.word === 'rock' && v.cefrLevel === 'A2' && v.partOfSpeech === 'n.',
    );
    expect(rockA2Nouns.length).toBeGreaterThanOrEqual(2);
    expect(rockA2Nouns[0].senseNumber).toBe(1);
    expect(rockA2Nouns[1].senseNumber).toBe(2);

    // Kiểm tra thứ tự tất định: LENGTH(word) ASC, word ASC, cefr_level ASC, part_of_speech ASC, sense_number ASC
    const items = rockRes.body.data;
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      const curr = items[i];
      expect(prev.word.length).toBeLessThanOrEqual(curr.word.length);
      if (prev.word.length === curr.word.length && prev.word === curr.word && prev.cefrLevel === curr.cefrLevel && prev.partOfSpeech === curr.partOfSpeech) {
        expect(prev.senseNumber).toBeLessThanOrEqual(curr.senseNumber);
      }
    }
  });

  it('US4-AS2: Tra cứu GET /api/v1/vocabularies/search?q=  ABANDON   -> tự động trim và lowercase, tìm đúng từ abandon', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/vocabularies/search')
      .query({ q: '  ABANDON  ' })
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].word).toBe('abandon');
  });

  it('US4-AS3: Tra cứu từ khóa không có trong Oxford 3000 -> trả về mảng rỗng [] với mã 200 OK', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/vocabularies/search?q=nonexistentword123')
      .expect(200);
    expect(res.body).toEqual({
      success: true,
      data: [],
      error: null,
    });
  });

  it('Test Prefix Match & SQL Wildcard: Tra cứu từ khóa chứa % hoặc _ -> escape chính xác, không quét wildcard toàn bảng', async () => {
    const resPercent = await request(app.getHttpServer())
      .get('/api/v1/vocabularies/search')
      .query({ q: '%' })
      .expect(200);
    expect(resPercent.body.data).toEqual([]);

    const resUnderscore = await request(app.getHttpServer())
      .get('/api/v1/vocabularies/search')
      .query({ q: '___' })
      .expect(200);
    expect(resUnderscore.body.data).toEqual([]);
  });

  it('Test Limits: Gửi q rỗng hoặc > 100 ký tự, hoặc limit=999 -> trả về mã 400 Bad Request với VALIDATION_ERROR', async () => {
    const resEmpty = await request(app.getHttpServer())
      .get('/api/v1/vocabularies/search')
      .query({ q: '   ' })
      .expect(400);
    expect(resEmpty.body.error.code).toBe('VALIDATION_ERROR');

    const resLong = await request(app.getHttpServer())
      .get('/api/v1/vocabularies/search')
      .query({ q: 'a'.repeat(101) })
      .expect(400);
    expect(resLong.body.error.code).toBe('VALIDATION_ERROR');

    const resLimit = await request(app.getHttpServer())
      .get('/api/v1/vocabularies/search')
      .query({ q: 'a', limit: 999 })
      .expect(400);
    expect(resLimit.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('Test GET /api/v1/vocabularies/:id: Lấy chi tiết từ vựng theo ID hợp lệ; lấy ID 999999 trả về mã 404 VOCABULARY_NOT_FOUND', async () => {
    const resOk = await request(app.getHttpServer()).get('/api/v1/vocabularies/1').expect(200);
    expect(resOk.body.success).toBe(true);
    expect(resOk.body.data.id).toBe(1);

    const res404 = await request(app.getHttpServer())
      .get('/api/v1/vocabularies/999999')
      .expect(404);
    expect(res404.body).toEqual({
      success: false,
      data: null,
      error: {
        code: 'VOCABULARY_NOT_FOUND',
        message: 'Từ vựng không tồn tại',
        details: null,
      },
    });
  });
});
