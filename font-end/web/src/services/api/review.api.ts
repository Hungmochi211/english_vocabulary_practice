import { httpClient } from '@/services/api/httpClient';
import type { DueReviewsResponse, QuizAttemptStart } from '@/types/models';

export const reviewApi = {
  getDueReviews(): Promise<DueReviewsResponse> {
    return httpClient.get<DueReviewsResponse>('/reviews/due');
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
