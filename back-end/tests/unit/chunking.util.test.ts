import {
  calculateLessonPartition,
  chunkVocabulariesIntoLessons,
} from '../../src/database/seeds/chunking.util';

describe('Chunking Utility - Exact Integer Partition Search (R3)', () => {
  it('US1-AS3: Test với 34 từ vựng -> tạo 2 bài học (17, 17 từ)', () => {
    const res = calculateLessonPartition(34, 'A1', 'daily_life');
    expect(res.isValid).toBe(true);
    expect(res.lessonSizes).toEqual([17, 17]);

    const dummyWords = Array.from({ length: 34 }, (_, i) => ({ id: i + 1, word: `w${i + 1}` }));
    const chunks = chunkVocabulariesIntoLessons(dummyWords, 'A1', 'daily_life', 'Daily Life & Routines');
    expect(chunks.isValid).toBe(true);
    expect(chunks.lessons).toHaveLength(2);
    expect(chunks.lessons[0].words).toHaveLength(17);
    expect(chunks.lessons[1].words).toHaveLength(17);
    expect(chunks.lessons[0].orderIndex).toBe(1);
    expect(chunks.lessons[1].orderIndex).toBe(2);
  });

  it('US1-AS4: Test với 19 từ vựng -> tạo 1 bài học (19 từ)', () => {
    const res = calculateLessonPartition(19, 'A1', 'daily_life');
    expect(res.isValid).toBe(true);
    expect(res.lessonSizes).toEqual([19]);
  });

  it('Test với 37 từ vựng -> tạo 2 bài học (18, 19 từ, bài 19 từ nằm ở cuối nhóm)', () => {
    const res = calculateLessonPartition(37, 'A2', 'travel_transport');
    expect(res.isValid).toBe(true);
    expect(res.lessonSizes).toEqual([18, 19]);
  });

  it('Test với 48 từ vựng -> tạo 3 bài học (16, 16, 16 từ)', () => {
    const res = calculateLessonPartition(48, 'B1', 'education_work');
    expect(res.isValid).toBe(true);
    expect(res.lessonSizes).toEqual([16, 16, 16]);
  });

  it('Test với 92 từ vựng -> tạo 5 bài học (18, 18, 18, 18, 20 từ - bài 20 từ ở cuối nhóm)', () => {
    const res = calculateLessonPartition(92, 'B2', 'society_law');
    expect(res.isValid).toBe(true);
    expect(res.lessonSizes).toEqual([18, 18, 18, 18, 20]);
  });

  it('US1-AS6: Test với 124 từ vựng -> tạo 7 bài học (17, 17, 18, 18, 18, 18, 18 từ - ưu tiên k nhỏ nhất)', () => {
    const res = calculateLessonPartition(124, 'A1', 'people_relationships');
    expect(res.isValid).toBe(true);
    expect(res.lessonSizes).toEqual([17, 17, 18, 18, 18, 18, 18]);
  });

  it('Test với 14 từ vựng (< 15 từ) -> trả về isValid: false, 0 bài học và cảnh báo SEED_WARNING', () => {
    const res = calculateLessonPartition(14, 'A1', 'daily_life');
    expect(res.isValid).toBe(false);
    expect(res.lessonSizes).toEqual([]);
    expect(res.warning).toContain('[SEED_WARNING]');
  });

  it('Test với 25 từ vựng (khoảng không hợp lệ 21-29) -> trả về isValid: false, 0 bài học và cảnh báo SEED_WARNING', () => {
    const res = calculateLessonPartition(25, 'A2', 'food_health');
    expect(res.isValid).toBe(false);
    expect(res.lessonSizes).toEqual([]);
    expect(res.warning).toContain('[SEED_WARNING]');
  });

  it('Test với 42 từ vựng (khoảng không hợp lệ 41-44) -> trả về isValid: false, 0 bài học và cảnh báo SEED_WARNING', () => {
    const res = calculateLessonPartition(42, 'B1', 'home_environment');
    expect(res.isValid).toBe(false);
    expect(res.lessonSizes).toEqual([]);
    expect(res.warning).toContain('[SEED_WARNING]');
  });
});
