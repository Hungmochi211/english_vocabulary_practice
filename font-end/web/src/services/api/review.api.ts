import { httpClient } from '@/services/api/httpClient';
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

  startSm2Session(limit = 20): Promise<QuizAttemptStart> {
    const safeLimit = Math.max(1, Math.min(50, Math.round(limit)));
    return httpClient.post<QuizAttemptStart>('/reviews/session/start', { limit: safeLimit });
  },

  startMixedQuiz(totalQuestions = 10): Promise<QuizAttemptStart> {
    const safeTotal = Math.max(5, Math.min(40, Math.round(totalQuestions)));
    return httpClient.post<QuizAttemptStart>('/learning/quizzes/mixed/start', {
      totalQuestions: safeTotal,
    });
  },
};
