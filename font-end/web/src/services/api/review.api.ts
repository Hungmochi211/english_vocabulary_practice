import { httpClient } from '@/services/api/httpClient';
import { normalizeQuizAttemptStart } from '@/services/api/normalizers';
import type { DueReviewsResponse, QuizAttemptStart } from '@/types/models';

type RawDueReviewsResponse = Partial<DueReviewsResponse> & {
  totalDue?: number;
};

export const reviewApi = {
  async getDueReviews(limit = 20): Promise<DueReviewsResponse> {
    const safeLimit = Math.max(1, Math.min(50, Math.round(limit)));
    const raw = await httpClient.get<RawDueReviewsResponse>('/reviews/due', {
      params: { limit: safeLimit },
    });
    const items = Array.isArray(raw?.items) ? raw.items : [];
    return {
      dueCount: raw?.dueCount ?? raw?.totalDue ?? items.length,
      leitnerDistribution: raw?.leitnerDistribution,
      items,
    };
  },

  async startSm2Session(limit = 20): Promise<QuizAttemptStart> {
    const safeLimit = Math.max(1, Math.min(50, Math.round(limit)));
    const raw = await httpClient.post<unknown>('/reviews/session/start', { limit: safeLimit });
    return normalizeQuizAttemptStart(raw);
  },

  async startMixedQuiz(totalQuestions = 10): Promise<QuizAttemptStart> {
    const safeTotal = Math.max(5, Math.min(40, Math.round(totalQuestions)));
    const raw = await httpClient.post<unknown>('/learning/quizzes/mixed/start', {
      totalQuestions: safeTotal,
    });
    return normalizeQuizAttemptStart(raw);
  },
};
