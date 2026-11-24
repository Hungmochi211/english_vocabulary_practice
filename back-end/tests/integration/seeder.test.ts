import * as path from 'path';
import { AppDataSource } from '../../src/config/database.config';
import { seedTopics } from '../../src/database/seeds/topic.seeder';
import {
  seedVocabulariesAndLessons,
  assignSenseNumbers,
  RawVocabRow,
} from '../../src/database/seeds/vocabulary.seeder';

describe('Seeder Integration Tests (US1)', () => {
  const excelPath = path.resolve(__dirname, '../../../tools/oxford_3000_vocabulary.xlsx');

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  it('US1-AS1 & US1-AS5: Nạp database trống -> đủ 16 chủ đề, >= 3.500 từ sạch 100%, 100% bài học có 15-18 từ (bài cuối <= 20), 0 bài < 15 từ', async () => {
    await AppDataSource.query('TRUNCATE TABLE lesson_vocabularies, lessons, vocabularies, topics RESTART IDENTITY CASCADE;');

    await seedTopics(AppDataSource);
    await seedVocabulariesAndLessons(AppDataSource, excelPath);

    const topicsRes = await AppDataSource.query('SELECT COUNT(*)::int AS cnt FROM topics;');
    expect(topicsRes[0].cnt).toBe(16);

    const vocabRes = await AppDataSource.query('SELECT COUNT(*)::int AS cnt FROM vocabularies;');
    expect(vocabRes[0].cnt).toBeGreaterThanOrEqual(3500);

    // US1-AS5: word sạch 100%, phonetic định dạng ^/.+/$ không chứa *
    const dirtyWordRes = await AppDataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM vocabularies WHERE word ~ '[0-9()]' OR word LIKE E'%\\u00A0%';`,
    );
    expect(dirtyWordRes[0].cnt).toBe(0);

    const invalidPhoneticRes = await AppDataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM vocabularies WHERE phonetic !~ '^/.+/$' OR phonetic LIKE '%*%';`,
    );
    expect(invalidPhoneticRes[0].cnt).toBe(0);

    // US1-AS1: 0 bài nào < 15 hoặc > 20, và các bài trước bài cuối đều <= 18
    const invalidLessonSize = await AppDataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM lessons WHERE word_count < 15 OR word_count > 20;`,
    );
    expect(invalidLessonSize[0].cnt).toBe(0);

    const nonLastOver18 = await AppDataSource.query(`
      SELECT COUNT(*)::int AS cnt
      FROM lessons l
      WHERE l.word_count > 18
        AND l.order_index < (
          SELECT MAX(l2.order_index)
          FROM lessons l2
          WHERE l2.topic_id = l.topic_id AND l2.cefr_level = l.cefr_level
        );
    `);
    expect(nonLastOver18[0].cnt).toBe(0);
  });

  it('US1-AS2: Chạy Seeder lần thứ 2 -> tổng số dòng không thay đổi, Idempotent', async () => {
    const beforeVocab = await AppDataSource.query('SELECT COUNT(*)::int AS cnt FROM vocabularies;');
    const beforeLessons = await AppDataSource.query('SELECT COUNT(*)::int AS cnt FROM lessons;');

    await seedTopics(AppDataSource);
    await seedVocabulariesAndLessons(AppDataSource, excelPath);

    const afterVocab = await AppDataSource.query('SELECT COUNT(*)::int AS cnt FROM vocabularies;');
    const afterLessons = await AppDataSource.query('SELECT COUNT(*)::int AS cnt FROM lessons;');

    expect(afterVocab[0].cnt).toBe(beforeVocab[0].cnt);
    expect(afterLessons[0].cnt).toBe(beforeLessons[0].cnt);
  });

  it('Test sense_number: cùng file nguồn tạo cùng sense_number (rock A2 n. -> 1, 2); khi đổi thứ tự hoặc nội dung, đánh lại từ 1 đồng bộ', async () => {
    const rockSenses = await AppDataSource.query(
      `SELECT sense_number, vietnamese_meaning FROM vocabularies WHERE word = 'rock' AND cefr_level = 'A2' AND part_of_speech = 'n.' ORDER BY sense_number ASC;`,
    );
    expect(rockSenses.length).toBeGreaterThanOrEqual(2);
    expect(rockSenses[0].sense_number).toBe(1);
    expect(rockSenses[1].sense_number).toBe(2);

    const sampleRows: RawVocabRow[] = [
      {
        word: 'rock',
        cefrLevel: 'A2',
        partOfSpeech: 'n.',
        phonetic: '/rɒk/',
        vietnameseMeaning: 'nhạc rock',
        exampleEn: 'He loves rock music.',
        exampleVi: 'Anh ấy yêu nhạc rock.',
        topicName: 'Entertainment & Media',
      },
      {
        word: 'rock',
        cefrLevel: 'A2',
        partOfSpeech: 'n.',
        phonetic: '/rɒk/',
        vietnameseMeaning: 'đá, tảng đá',
        exampleEn: 'A big rock.',
        exampleVi: 'Một tảng đá lớn.',
        topicName: 'Home & Environment',
      },
    ];
    const numbered = assignSenseNumbers(sampleRows);
    expect(numbered[0].senseNumber).toBe(1);
    expect(numbered[0].vietnameseMeaning).toBe('nhạc rock');
    expect(numbered[1].senseNumber).toBe(2);
    expect(numbered[1].vietnameseMeaning).toBe('đá, tảng đá');
  });

  it('Test Transaction Rollback: Giả lập lỗi giữa chừng -> rollback toàn bộ transaction, không để lại dữ liệu dở dang', async () => {
    const beforeVocab = (await AppDataSource.query('SELECT COUNT(*)::int AS cnt FROM vocabularies;'))[0].cnt;

    await expect(
      seedVocabulariesAndLessons(AppDataSource, excelPath, { simulateFailureAfterFirstSheet: true }),
    ).rejects.toThrow();

    const afterVocab = (await AppDataSource.query('SELECT COUNT(*)::int AS cnt FROM vocabularies;'))[0].cnt;
    expect(afterVocab).toBe(beforeVocab);
  });
});
