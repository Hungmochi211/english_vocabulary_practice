import {
  deriveQualityRating,
  calculateNextSm2State,
  mapRepetitionsToLeitnerBox,
} from '../../../src/modules/algorithm/sm2-leitner.service';

describe('Pure Algorithm: SuperMemo SM-2 & 5 Leitner Boxes (US4-AS1..US4-AS5)', () => {
  it('Quy đổi q tự động đúng tại các biên 5.000 ms, 12.000 ms và trạng thái bỏ trống', () => {
    expect(deriveQualityRating('exact', 5000, 'abandon')).toBe(5);
    expect(deriveQualityRating('exact', 3200, 'abandon')).toBe(5);
    expect(deriveQualityRating('exact', 5001, 'abandon')).toBe(4);
    expect(deriveQualityRating('exact', 12000, 'abandon')).toBe(4);
    expect(deriveQualityRating('exact', 12001, 'abandon')).toBe(3);
    expect(deriveQualityRating('near_match', 2000, 'peopel')).toBe(3);
    expect(deriveQualityRating('phonetic_match', 2000, 'fone')).toBe(2);
    expect(deriveQualityRating('incorrect', 2000, 'wrong')).toBe(1);
    expect(deriveQualityRating('incorrect', 2000, null)).toBe(0);
    expect(deriveQualityRating('incorrect', 2000, '   ')).toBe(0);
  });

  it('US4-AS1: Ôn lần đầu (EF=2.50, n=0, I=0) với q=4 -> EF=2.50, n=1, I=1, Hộp 2, ngày D+1', () => {
    const next = calculateNextSm2State(
      { easinessFactor: 2.5, repetitions: 0, intervalDays: 0 },
      4,
      '2026-11-24',
    );
    expect(next.easinessFactor).toBe(2.5);
    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(next.leitnerBox).toBe(2);
    expect(next.nextReviewDate).toBe('2026-11-25');
  });

  it('US4-AS2: (EF=2.50, n=1, I=1) tại D+1 với q=5 -> EF=2.60, n=2, I=6, Hộp 3, ngày D+7', () => {
    const next = calculateNextSm2State(
      { easinessFactor: 2.5, repetitions: 1, intervalDays: 1 },
      5,
      '2026-11-25',
    );
    expect(next.easinessFactor).toBe(2.6);
    expect(next.repetitions).toBe(2);
    expect(next.intervalDays).toBe(6);
    expect(next.leitnerBox).toBe(3);
    expect(next.nextReviewDate).toBe('2026-12-01');
  });

  it('US4-AS3: (EF=2.60, n=2, I=6) tại D+7 với q=3 -> EF=2.46, n=3, I=round(6*2.46)=15, Hộp 4', () => {
    const next = calculateNextSm2State(
      { easinessFactor: 2.6, repetitions: 2, intervalDays: 6 },
      3,
      '2026-12-01',
    );
    expect(next.easinessFactor).toBe(2.46);
    expect(next.repetitions).toBe(3);
    expect(next.intervalDays).toBe(15);
    expect(next.leitnerBox).toBe(4);
    expect(next.nextReviewDate).toBe('2026-12-16');
  });

  it('US4-AS4: Đang ở Hộp 4 (EF=2.46, n=3, I=15) trả lời sai q=1 -> EF=1.92, n=0, I=1, Hộp 1', () => {
    const next = calculateNextSm2State(
      { easinessFactor: 2.46, repetitions: 3, intervalDays: 15 },
      1,
      '2026-12-16',
    );
    expect(next.easinessFactor).toBe(1.92);
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.leitnerBox).toBe(1);
    expect(next.nextReviewDate).toBe('2026-12-17');
  });

  it('US4-AS5: EF=1.50 gặp q=0 -> chặn sàn EF=1.30, n=0, I=1, Hộp 1', () => {
    const next = calculateNextSm2State(
      { easinessFactor: 1.5, repetitions: 2, intervalDays: 6 },
      0,
      '2026-12-16',
    );
    expect(next.easinessFactor).toBe(1.3);
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.leitnerBox).toBe(1);
  });

  it('Ánh xạ 1-1 số lần nhớ liên tiếp n -> 5 Hộp Leitner', () => {
    expect(mapRepetitionsToLeitnerBox(0)).toBe(1);
    expect(mapRepetitionsToLeitnerBox(1)).toBe(2);
    expect(mapRepetitionsToLeitnerBox(2)).toBe(3);
    expect(mapRepetitionsToLeitnerBox(3)).toBe(4);
    expect(mapRepetitionsToLeitnerBox(4)).toBe(4);
    expect(mapRepetitionsToLeitnerBox(5)).toBe(5);
    expect(mapRepetitionsToLeitnerBox(12)).toBe(5);
  });
});
