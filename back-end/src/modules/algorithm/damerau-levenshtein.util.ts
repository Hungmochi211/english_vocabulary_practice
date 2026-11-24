import { isPhoneticMatch } from './phonetic.util';

export type GradingStatus = 'exact' | 'near_match' | 'phonetic_match' | 'incorrect';
export type PracticeMode = 'multiple_choice' | 'typing' | 'dictation';

export interface TextGradeResult {
  gradingStatus: GradingStatus;
  score: 1.0 | 0.5 | 0.0;
  damerauDistance: number;
  soundexMatched: boolean | null;
  feedbackMessage: string;
}

export function normalizeAnswer(input: string | null | undefined): string {
  if (typeof input !== 'string') return '';
  return input.replace(/\u00A0/g, ' ').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Optimal String Alignment (Damerau-Levenshtein) distance with cost 1 for:
 * insertion, deletion, substitution, and adjacent transposition.
 */
export function damerauLevenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = best;
    }
  }

  return dp[m][n];
}

export function gradeTextAnswer(
  rawUserAnswer: string | null | undefined,
  targetWord: string,
  mode: PracticeMode,
): TextGradeResult {
  const userNorm = normalizeAnswer(rawUserAnswer);
  const targetNorm = normalizeAnswer(targetWord);

  if (!userNorm) {
    return {
      gradingStatus: 'incorrect',
      score: 0.0,
      damerauDistance: targetNorm.length,
      soundexMatched: mode === 'dictation' ? false : null,
      feedbackMessage: `Chưa có câu trả lời. Đáp án đúng là: ${targetWord}`,
    };
  }

  const dist = damerauLevenshteinDistance(userNorm, targetNorm);

  if (dist === 0) {
    return {
      gradingStatus: 'exact',
      score: 1.0,
      damerauDistance: 0,
      soundexMatched: mode === 'dictation' ? true : null,
      feedbackMessage: 'Chính xác!',
    };
  }

  // FR-007: Near match chỉ áp dụng khi độ dài từ mục tiêu >= 3 và distance = 1
  if ((mode === 'typing' || mode === 'dictation') && targetNorm.length >= 3 && dist === 1) {
    return {
      gradingStatus: 'near_match',
      score: 0.5,
      damerauDistance: dist,
      soundexMatched: mode === 'dictation' ? false : null,
      feedbackMessage: `Gần đúng! Mặt chữ chuẩn là: ${targetWord}`,
    };
  }

  // FR-007: Phonetic match chỉ áp dụng trong bài Dictation khi distance >= 2
  if (mode === 'dictation' && dist >= 2) {
    const phoneticMatched = isPhoneticMatch(userNorm, targetNorm);
    if (phoneticMatched) {
      return {
        gradingStatus: 'phonetic_match',
        score: 0.0,
        damerauDistance: dist,
        soundexMatched: true,
        feedbackMessage: `Bạn nghe đúng phát âm nhưng viết sai chính tả! Từ đúng là: ${targetWord}`,
      };
    }
    return {
      gradingStatus: 'incorrect',
      score: 0.0,
      damerauDistance: dist,
      soundexMatched: false,
      feedbackMessage: `Chưa chính xác. Từ đúng là: ${targetWord}`,
    };
  }

  return {
    gradingStatus: 'incorrect',
    score: 0.0,
    damerauDistance: dist,
    soundexMatched: mode === 'dictation' ? false : null,
    feedbackMessage: `Chưa chính xác. Từ đúng là: ${targetWord}`,
  };
}
