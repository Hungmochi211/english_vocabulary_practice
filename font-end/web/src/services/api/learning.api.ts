import { httpClient } from '@/services/api/httpClient';
import type {
  CefrLevel,
  LessonProgressItem,
  QuizAnswerSubmission,
  QuizAttemptStart,
  QuizSubmitResult,
} from '@/types/models';

export interface LearningLessonsFilter {
  level?: CefrLevel | '';
  topicId?: number | null;
}

export const learningApi = {
  listLessons(filter?: LearningLessonsFilter): Promise<LessonProgressItem[]> {
    const params: Record<string, string | number> = {};
    if (filter?.level) params.level = filter.level;
    if (filter?.topicId) params.topicId = filter.topicId;
    return httpClient.get<LessonProgressItem[]>('/learning/lessons', { params });
  },

  openCard(lessonId: number, vocabularyId: number): Promise<LessonProgressItem> {
    return httpClient.post<LessonProgressItem>(
      `/learning/lessons/${lessonId}/cards/${vocabularyId}/open`,
    );
  },

  startLessonPractice(lessonId: number): Promise<QuizAttemptStart> {
    return httpClient.post<QuizAttemptStart>(`/learning/lessons/${lessonId}/practice/start`);
  },

  submitAttempt(attemptId: number, answers: QuizAnswerSubmission[]): Promise<QuizSubmitResult> {
    return httpClient.post<QuizSubmitResult>(`/learning/quizzes/${attemptId}/submit`, {
      answers,
    });
  },
};
