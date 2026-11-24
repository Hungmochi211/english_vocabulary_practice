import { fisherYatesShuffle } from '../../../src/modules/algorithm/fisher-yates.util';
import {
  normalizeAnswer,
  damerauLevenshteinDistance,
  gradeTextAnswer,
} from '../../../src/modules/algorithm/damerau-levenshtein.util';
import {
  soundex,
  doubleMetaphone,
  isPhoneticMatch,
} from '../../../src/modules/algorithm/phonetic.util';
import {
  selectDistractorsFromCandidates,
  VocabCandidate,
} from '../../../src/modules/algorithm/distractor.service';
import { stratifiedSample } from '../../../src/modules/algorithm/stratified-sampling.service';

describe('Pure Algorithms: Generation & Smart Grading (US3-AS1..US3-AS6)', () => {
  it('US3-AS1: Distractor 3 tầng không trùng word/meaning & Fisher-Yates phân bố đều 25% ± 3% qua 1.000 lần chạy', () => {
    const target: VocabCandidate = {
      id: 1,
      word: 'abandon',
      cefrLevel: 'B2',
      partOfSpeech: 'v.',
      topicId: 15,
      vietnameseMeaning: 'từ bỏ',
      audioUrl: null,
    };
    const pool: VocabCandidate[] = [
      target,
      { id: 2, word: 'abandon', cefrLevel: 'B2', partOfSpeech: 'v.', topicId: 15, vietnameseMeaning: 'bỏ rơi', audioUrl: null }, // same word -> excluded
      { id: 3, word: 'quit', cefrLevel: 'B2', partOfSpeech: 'v.', topicId: 15, vietnameseMeaning: 'từ bỏ', audioUrl: null }, // same meaning -> excluded
      { id: 4, word: 'accuse', cefrLevel: 'B2', partOfSpeech: 'v.', topicId: 15, vietnameseMeaning: 'buộc tội', audioUrl: null },
      { id: 5, word: 'arrest', cefrLevel: 'B2', partOfSpeech: 'v.', topicId: 15, vietnameseMeaning: 'bắt giữ', audioUrl: null },
      { id: 6, word: 'ban', cefrLevel: 'B2', partOfSpeech: 'v.', topicId: 15, vietnameseMeaning: 'cấm', audioUrl: null },
      { id: 7, word: 'judge', cefrLevel: 'B2', partOfSpeech: 'n.', topicId: 15, vietnameseMeaning: 'thẩm phán', audioUrl: null }, // wrong POS -> excluded
    ];

    const distractors = selectDistractorsFromCandidates(target, pool);
    expect(distractors).toHaveLength(3);
    for (const d of distractors) {
      expect(d.partOfSpeech).toBe('v.');
      expect(d.word.toLowerCase()).not.toBe('abandon');
      expect(d.vietnameseMeaning.toLowerCase()).not.toBe('từ bỏ');
    }

    // Fisher-Yates balance test over 1,000 runs (25% ± 3% => 220..280? Wait: 3 sigma is ~41 on 1000, let's check deterministic seeded or statistical bounds)
    const positionCounts = [0, 0, 0, 0];
    const iterations = 4000;
    for (let i = 0; i < iterations; i++) {
      const shuffled = fisherYatesShuffle(['A', 'B', 'C', 'D']);
      positionCounts[shuffled.indexOf('A')]++;
    }
    for (const count of positionCounts) {
      const ratio = count / iterations;
      expect(ratio).toBeGreaterThanOrEqual(0.22);
      expect(ratio).toBeLessThanOrEqual(0.28);
    }
  });

  it('US3-AS2 & Edge Case 5: Chuẩn hóa trim, gộp khoảng trắng thừa và lowercase -> Chính xác (1.0 điểm)', () => {
    expect(normalizeAnswer('  ABANDON  ')).toBe('abandon');
    expect(normalizeAnswer('ice   cream')).toBe('ice cream');

    const res1 = gradeTextAnswer('  ABANDON  ', 'abandon', 'typing');
    expect(res1.gradingStatus).toBe('exact');
    expect(res1.score).toBe(1.0);
    expect(res1.damerauDistance).toBe(0);

    const res2 = gradeTextAnswer('  ice    cream ', 'ice cream', 'typing');
    expect(res2.gradingStatus).toBe('exact');
    expect(res2.score).toBe(1.0);
  });

  it('US3-AS3: Damerau-Levenshtein = 1 trên từ dài >= 3 ký tự (đảo 2 ký tự liền kề / thiếu / thừa / thay 1 ký tự) -> Gần đúng (0.5 điểm)', () => {
    expect(damerauLevenshteinDistance('peopel', 'people')).toBe(1);
    expect(damerauLevenshteinDistance('peple', 'people')).toBe(1);
    expect(damerauLevenshteinDistance('peoplle', 'people')).toBe(1);
    expect(damerauLevenshteinDistance('peaple', 'people')).toBe(1);

    const resTrans = gradeTextAnswer('peopel', 'people', 'typing');
    expect(resTrans.gradingStatus).toBe('near_match');
    expect(resTrans.score).toBe(0.5);
    expect(resTrans.damerauDistance).toBe(1);

    const resDel = gradeTextAnswer('peple', 'people', 'typing');
    expect(resDel.gradingStatus).toBe('near_match');
    expect(resDel.score).toBe(0.5);
  });

  it('US3-AS4: Dictation với Damerau-Levenshtein >= 2 nhưng khớp Soundex/Double Metaphone (phone/fone, night/nite, write/rite) -> phonetic_match (0.0 điểm)', () => {
    expect(isPhoneticMatch('fone', 'phone')).toBe(true);
    expect(isPhoneticMatch('nite', 'night')).toBe(true);
    expect(isPhoneticMatch('rite', 'write')).toBe(true);
    expect(soundex('robert')).toBe('R163');
    expect(doubleMetaphone('phone')[0]).toBe(doubleMetaphone('fone')[0]);

    const resDict = gradeTextAnswer('fone', 'phone', 'dictation');
    expect(resDict.gradingStatus).toBe('phonetic_match');
    expect(resDict.score).toBe(0.0);
    expect(resDict.soundexMatched).toBe(true);

    // Ở chế độ typing thường (không phải dictation), không trả phonetic_match
    const resTyping = gradeTextAnswer('fone', 'phone', 'typing');
    expect(resTyping.gradingStatus).toBe('incorrect');
    expect(resTyping.score).toBe(0.0);
  });

  it('US3-AS5: Từ ngắn < 3 ký tự (in vs on) không áp dụng Gần đúng -> incorrect (0.0 điểm)', () => {
    const res = gradeTextAnswer('on', 'in', 'typing');
    expect(res.gradingStatus).toBe('incorrect');
    expect(res.score).toBe(0.0);
    expect(res.damerauDistance).toBe(1);
  });

  it('US3-AS6: Stratified Sampling 20 câu trên 4 chủ đề -> mỗi chủ đề đúng 5 câu', () => {
    const buckets = new Map<number, Array<{ id: number; topicId: number }>>();
    for (let t = 1; t <= 4; t++) {
      buckets.set(
        t,
        Array.from({ length: 10 }, (_, i) => ({ id: t * 100 + i, topicId: t })),
      );
    }

    const sampled = stratifiedSample(buckets, 20);
    expect(sampled).toHaveLength(20);

    const counts = new Map<number, number>();
    for (const item of sampled) {
      counts.set(item.topicId, (counts.get(item.topicId) ?? 0) + 1);
    }
    expect(counts.get(1)).toBe(5);
    expect(counts.get(2)).toBe(5);
    expect(counts.get(3)).toBe(5);
    expect(counts.get(4)).toBe(5);
  });
});
