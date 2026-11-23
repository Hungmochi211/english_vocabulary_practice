import { httpClient } from '@/services/api/httpClient';
import type {
  CefrLevel,
  LessonDetail,
  LessonProgressItem,
  PaginatedData,
  Topic,
  VocabularyItem,
} from '@/types/models';

export interface SearchVocabParams {
  q?: string;
  level?: CefrLevel | '';
  partOfSpeech?: string;
  topicId?: number | null;
  page?: number;
  limit?: number;
}

export const vocabularyApi = {
  listTopics(): Promise<Topic[]> {
    return httpClient.get<Topic[]>('/topics');
  },

  listLessons(params?: {
    level?: CefrLevel | '';
    topicId?: number | null;
    page?: number;
    limit?: number;
  }): Promise<PaginatedData<LessonProgressItem>> {
    return httpClient.get<PaginatedData<LessonProgressItem>>('/lessons', { params });
  },

  getLessonDetail(lessonId: number): Promise<LessonDetail> {
    return httpClient.get<LessonDetail>(`/lessons/${lessonId}`);
  },

  getVocabularyById(vocabularyId: number): Promise<VocabularyItem> {
    return httpClient.get<VocabularyItem>(`/vocabularies/${vocabularyId}`);
  },

  searchVocabularies(params: SearchVocabParams): Promise<PaginatedData<VocabularyItem>> {
    const query: Record<string, string | number> = {};
    if (params.q?.trim()) query.q = params.q.trim();
    if (params.level) query.level = params.level;
    if (params.partOfSpeech) query.partOfSpeech = params.partOfSpeech;
    if (params.topicId) query.topicId = params.topicId;
    if (params.page) query.page = params.page;
    if (params.limit) query.limit = params.limit;
    return httpClient.get<PaginatedData<VocabularyItem>>('/vocabularies/search', { params: query });
  },
};
