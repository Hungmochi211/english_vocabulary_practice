import { httpClient } from '@/services/api/httpClient';
import {
  normalizeLessonProgress,
  normalizeQuizAttemptStart,
  normalizeQuizSubmitResult,
} from '@/services/api/normalizers';
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
  async listLessons(filter?: LearningLessonsFilter): Promise<LessonProgressItem[]> {
    const params: Record<string, string | number> = {};
    if (filter?.level) params.level = filter.level;
    if (filter?.topicId) params.topicId = filter.topicId;
    const raw = await httpClient.get<unknown[]>('/learning/lessons', { params });
    return Array.isArray(raw)
      ? raw.map((item) => normalizeLessonProgress(item as Partial<LessonProgressItem>))
      : [];
  },

  async openCard(lessonId: number, vocabularyId: number): Promise<LessonProgressItem> {
    const raw = await httpClient.post<Partial<LessonProgressItem> & { totalWords?: number }>(
      `/learning/lessons/${lessonId}/cards/${vocabularyId}/open`,
    );
    return normalizeLessonProgress(raw, lessonId);
  },

  async startLessonPractice(lessonId: number): Promise<QuizAttemptStart> {
    const raw = await httpClient.post<unknown>(`/learning/lessons/${lessonId}/practice/start`);
    return normalizeQuizAttemptStart(raw);
  },

  async submitAttempt(attemptId: number, answers: QuizAnswerSubmission[]): Promise<QuizSubmitResult> {
    const raw = await httpClient.post<unknown>(`/learning/quizzes/${attemptId}/submit`, {
      answers,
    });
    return normalizeQuizSubmitResult(raw);
  },
};
