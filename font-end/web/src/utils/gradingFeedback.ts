import type { GradingStatus } from '@/types/models';

export interface GradingFeedbackMeta {
  status: GradingStatus;
  label: string;
  shortHint: string;
  tone: 'green' | 'amber' | 'blue' | 'rose';
  defaultPoints: number;
  badgeClass: string;
  panelClass: string;
}

const GRADING_META_MAP: Record<GradingStatus, GradingFeedbackMeta> = {
  exact: {
    status: 'exact',
    label: 'Chính xác',
    shortHint: 'Khớp hoàn toàn 100% với từ mục tiêu (+1.0 điểm).',
    tone: 'green',
    defaultPoints: 1,
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    panelClass: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
  },
  near_match: {
    status: 'near_match',
    label: 'Gần đúng',
    shortHint: 'Sai lệch 1 ký tự ở từ dài từ 3 ký tự trở lên (+0.5 điểm).',
    tone: 'amber',
    defaultPoints: 0.5,
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
    panelClass: 'border-amber-200 bg-amber-50/70 text-amber-900',
  },
  phonetic_match: {
    status: 'phonetic_match',
    label: 'Đúng âm sai chữ',
    shortHint: 'Âm đọc tương đương nhưng sai mặt chữ (+0.25 điểm).',
    tone: 'blue',
    defaultPoints: 0.25,
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-800',
    panelClass: 'border-sky-200 bg-sky-50/70 text-sky-900',
  },
  incorrect: {
    status: 'incorrect',
    label: 'Chưa chính xác',
    shortHint: 'Cần ôn lại từ này để ghi nhớ chắc hơn (0 điểm).',
    tone: 'rose',
    defaultPoints: 0,
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-800',
    panelClass: 'border-rose-200 bg-rose-50/70 text-rose-900',
  },
};

export function getGradingFeedbackMeta(status: GradingStatus): GradingFeedbackMeta {
  return GRADING_META_MAP[status] ?? GRADING_META_MAP.incorrect;
}

export function damerauLevenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }

  return dp[m][n];
}

function computePhoneticCode(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/gh/g, '');
  if (!cleaned) return '';

  const weights: Record<string, string> = {
    b: '1',
    f: '1',
    p: '1',
    v: '1',
    c: '2',
    g: '2',
    j: '2',
    k: '2',
    q: '2',
    s: '2',
    x: '2',
    z: '2',
    d: '3',
    t: '3',
    l: '4',
    m: '5',
    n: '5',
    r: '6',
  };

  let code = cleaned[0];
  let prev = weights[cleaned[0]] ?? '';
  for (let i = 1; i < cleaned.length; i += 1) {
    const digit = weights[cleaned[i]] ?? '';
    if (digit && digit !== prev) {
      code += digit;
    }
    prev = digit;
  }

  return code.padEnd(4, '0').slice(0, 4);
}

export interface LocalGradeResult {
  gradingStatus: GradingStatus;
  pointsAwarded: number;
  feedbackMessage: string;
}

/**
 * Client-side grading helper used for `client_custom_practice` sessions (Saved Words / History retry).
 * Mirrors `002-backend-core` grading_status_enum rules strictly:
 * - `exact` (1.0 pt)
 * - `near_match` (0.5 pt) ONLY when `targetWord.length >= 3` and Damerau-Levenshtein distance === 1
 * - `phonetic_match` (0.25 pt) when `targetWord.length >= 3` and phonetic codes match
 * - `incorrect` (0.0 pt) for everything else, including all `< 3`-character short words (e.g., `go` vs `do`)
 */
export function gradeLocalAnswer(targetWord: string, userAnswer: string | null): LocalGradeResult {
  const target = targetWord.trim().toLowerCase();
  const actual = (userAnswer ?? '').trim().toLowerCase();

  if (!actual) {
    return {
      gradingStatus: 'incorrect',
      pointsAwarded: 0,
      feedbackMessage: `Chưa chính xác. Đáp án đúng là "${targetWord}".`,
    };
  }

  if (actual === target) {
    return {
      gradingStatus: 'exact',
      pointsAwarded: 1,
      feedbackMessage: 'Chính xác tuyệt đối!',
    };
  }

  if (target.length >= 3 && damerauLevenshteinDistance(actual, target) === 1) {
    return {
      gradingStatus: 'near_match',
      pointsAwarded: 0.5,
      feedbackMessage: `Gần đúng! Chú ý chính tả của "${targetWord}".`,
    };
  }

  if (target.length >= 3 && computePhoneticCode(actual) === computePhoneticCode(target)) {
    return {
      gradingStatus: 'phonetic_match',
      pointsAwarded: 0.25,
      feedbackMessage: `Đúng âm sai chữ. Cách viết đúng là "${targetWord}".`,
    };
  }

  return {
    gradingStatus: 'incorrect',
    pointsAwarded: 0,
    feedbackMessage: `Chưa chính xác. Đáp án đúng là "${targetWord}".`,
  };
}
