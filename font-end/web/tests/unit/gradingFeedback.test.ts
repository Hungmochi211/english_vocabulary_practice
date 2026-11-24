import { describe, expect, it } from 'vitest';
import { getGradingFeedbackMeta, gradeLocalAnswer } from '@/utils/gradingFeedback';
import type { GradingStatus } from '@/types/models';

describe('T029 - gradingFeedback (002-backend-core grading_status_enum parity)', () => {
  it('maps all 4 official GradingStatus values to consistent Vietnamese labels and tones', () => {
    const cases: Array<{ status: GradingStatus; label: string; tone: string; points: number }> = [
      { status: 'exact', label: 'Chính xác', tone: 'green', points: 1 },
      { status: 'near_match', label: 'Gần đúng', tone: 'amber', points: 0.5 },
      { status: 'phonetic_match', label: 'Đúng âm sai chữ', tone: 'blue', points: 0 },
      { status: 'incorrect', label: 'Chưa chính xác', tone: 'rose', points: 0 },
    ];

    for (const c of cases) {
      const meta = getGradingFeedbackMeta(c.status);
      expect(meta.label).toBe(c.label);
      expect(meta.tone).toBe(c.tone);
      expect(meta.defaultPoints).toBe(c.points);
    }
  });

  it('grades exact match (case-insensitive & trimmed) as exact (1.0 pt)', () => {
    const result = gradeLocalAnswer('peaceful', '  Peaceful ');
    expect(result.gradingStatus).toBe('exact');
    expect(result.pointsAwarded).toBe(1);
  });

  it('grades 1-character typo/transposition as near_match (0.5 pt) ONLY when word length >= 3', () => {
    const transposition = gradeLocalAnswer('peaceful', 'paeceful');
    expect(transposition.gradingStatus).toBe('near_match');
    expect(transposition.pointsAwarded).toBe(0.5);

    const threeChar = gradeLocalAnswer('cat', 'cot');
    expect(threeChar.gradingStatus).toBe('near_match');
    expect(threeChar.pointsAwarded).toBe(0.5);
  });

  it('MUST grade short words (< 3 chars) with 1-char difference as incorrect (0.0 pt), never near_match', () => {
    const goVsDo = gradeLocalAnswer('go', 'do');
    expect(goVsDo.gradingStatus).toBe('incorrect');
    expect(goVsDo.pointsAwarded).toBe(0);

    const inVsOn = gradeLocalAnswer('in', 'on');
    expect(inVsOn.gradingStatus).toBe('incorrect');
    expect(inVsOn.pointsAwarded).toBe(0);
  });

  it('grades phonetically similar misspellings (e.g., phone vs fone) as phonetic_match (0.0 pt)', () => {
    const result = gradeLocalAnswer('phone', 'fone');
    expect(result.gradingStatus).toBe('phonetic_match');
    expect(result.pointsAwarded).toBe(0);
  });

  it('grades empty or unrelated answers as incorrect (0.0 pt)', () => {
    expect(gradeLocalAnswer('peaceful', '').gradingStatus).toBe('incorrect');
    expect(gradeLocalAnswer('peaceful', 'butterfly').gradingStatus).toBe('incorrect');
  });
});
