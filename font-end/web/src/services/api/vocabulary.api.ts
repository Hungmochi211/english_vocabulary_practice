import { ApiError, httpClient } from '@/services/api/httpClient';
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

interface BackendLessonSummaryShape {
  id?: number;
  lessonId?: number;
  title?: string;
  cefrLevel?: CefrLevel;
  topicId?: number;
  topicName?: string;
  topicNameVi?: string;
  orderIndex?: number;
  wordCount?: number;
  openedVocabularyIds?: number[];
}

interface BackendNestedLessonDetail {
  lesson: BackendLessonSummaryShape;
  vocabularies: VocabularyItem[];
}

type RawLessonDetailResponse = LessonDetail | BackendNestedLessonDetail;
type RawSearchResponse = PaginatedData<VocabularyItem> | VocabularyItem[];

function normalizeLessonDetail(raw: RawLessonDetailResponse): LessonDetail {
  if ('lesson' in raw) {
    const l = raw.lesson;
    return {
      id: l.id ?? l.lessonId ?? 0,
      title: l.title ?? '',
      cefrLevel: l.cefrLevel ?? 'A1',
      topicId: l.topicId ?? 0,
      topicName: l.topicName ?? l.topicNameVi ?? '',
      orderIndex: l.orderIndex ?? 0,
      wordCount: l.wordCount ?? raw.vocabularies.length,
      openedVocabularyIds: l.openedVocabularyIds,
      vocabularies: Array.isArray(raw.vocabularies) ? raw.vocabularies : [],
    };
  }
  return raw;
}

function normalizeSearchResponse(
  raw: RawSearchResponse,
  page: number,
  limit: number,
  filter?: Pick<SearchVocabParams, 'level' | 'partOfSpeech' | 'topicId'>,
): PaginatedData<VocabularyItem> {
  if (Array.isArray(raw)) {
    let items = raw;
    if (filter?.level) {
      items = items.filter((v) => v.cefrLevel === filter.level);
    }
    if (filter?.partOfSpeech) {
      const targetPos = filter.partOfSpeech.toLowerCase();
      items = items.filter((v) =>
        v.partOfSpeech
          .toLowerCase()
          .replace(/\./g, '')
          .split(',')
          .map((p) => p.trim())
          .includes(targetPos),
      );
    }
    if (filter?.topicId) {
      items = items.filter((v) => v.topicId === filter.topicId);
    }
    return {
      items,
      page,
      limit,
      total: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / Math.max(1, limit))),
    };
  }
  return raw;
}

export const vocabularyApi = {
  listTopics(): Promise<Topic[]> {
    return httpClient.get<Topic[]>('/topics');
  },

  async listLessons(params?: {
    level?: CefrLevel | '';
    topicId?: number | null;
    page?: number;
    limit?: number;
  }): Promise<PaginatedData<LessonProgressItem>> {
    const raw = await httpClient.get<PaginatedData<LessonProgressItem> | LessonProgressItem[]>(
      '/lessons',
      { params },
    );
    if (Array.isArray(raw)) {
      return {
        items: raw,
        page: params?.page ?? 1,
        limit: params?.limit ?? (raw.length || 20),
        total: raw.length,
        totalPages: 1,
      };
    }
    return raw;
  },

  async getLessonDetail(lessonId: number): Promise<LessonDetail> {
    const raw = await httpClient.get<RawLessonDetailResponse>(`/lessons/${lessonId}`);
    return normalizeLessonDetail(raw);
  },

  getVocabularyById(vocabularyId: number): Promise<VocabularyItem> {
    return httpClient.get<VocabularyItem>(`/vocabularies/${vocabularyId}`);
  },

  async searchVocabularies(params: SearchVocabParams): Promise<PaginatedData<VocabularyItem>> {
    const page = Math.max(1, params.page ?? 1);
    // 001-vocabulary-data OpenAPI enforces limit <= 50
    const limit = Math.max(1, Math.min(50, params.limit ?? 20));
    const query: Record<string, string | number> = { limit };
    if (params.q?.trim()) query.q = params.q.trim().slice(0, 100);
    if (params.level) query.level = params.level;
    if (params.partOfSpeech) query.partOfSpeech = params.partOfSpeech;
    if (params.topicId) query.topicId = params.topicId;
    if (params.page) query.page = page;

    try {
      const raw = await httpClient.get<RawSearchResponse>('/vocabularies/search', {
        params: query,
      });
      return normalizeSearchResponse(raw, page, limit, params);
    } catch (err) {
      // Real 001 Backend requires q.length >= 1 on /vocabularies/search; return empty gracefully when browsing without q
      if (!params.q?.trim() && err instanceof ApiError && err.status === 400) {
        return { items: [], page, limit, total: 0, totalPages: 1 };
      }
      throw err;
    }
  },
};
