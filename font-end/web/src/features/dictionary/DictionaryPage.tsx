import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bookmark,
  BookmarkCheck,
  Copy,
  Search,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { vocabularyApi } from '@/services/api/vocabulary.api';
import {
  SAVED_WORDS_EVENT,
  savedWordsAdapter,
} from '@/services/adapters/savedWords.adapter';
import {
  computeSpellingSuggestions,
  highlightWordInExample,
  matchesVietnameseOrEnglish,
} from '@/utils/fuzzySearch';
import { useVocabularyAudio } from '@/hooks/useVocabularyAudio';
import { EmptyState, ErrorRetryBox, Skeleton, useToast } from '@/components/common/CommonUi';
import type { CefrLevel, SavedWordRecord, VocabularyItem } from '@/types/models';

const CEFR_FILTERS: Array<{ value: CefrLevel | ''; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'A1', label: 'A1' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
];

const POS_OPTIONS = [
  { value: '', label: 'Mọi loại từ' },
  { value: 'n', label: 'Danh từ (n)' },
  { value: 'v', label: 'Động từ (v)' },
  { value: 'adj', label: 'Tính từ (adj)' },
  { value: 'adv', label: 'Trạng từ (adv)' },
  { value: 'prep', label: 'Giới từ (prep)' },
];

export function DictionaryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const { showToast } = useToast();
  const { play } = useVocabularyAudio();

  const [queryText, setQueryText] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [selectedLevel, setSelectedLevel] = useState<CefrLevel | ''>('');
  const [selectedPos, setSelectedPos] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [onlySaved, setOnlySaved] = useState(false);
  const [limit, setLimit] = useState(20);
  const [selectedWordId, setSelectedWordId] = useState<number | null>(null);
  const [savedRecords, setSavedRecords] = useState<SavedWordRecord[]>(() =>
    savedWordsAdapter.list(),
  );

  useEffect(() => {
    const urlQ = searchParams.get('q') ?? '';
    if (urlQ !== queryText) {
      setQueryText(urlQ);
      setDebouncedQuery(urlQ);
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(queryText);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [queryText]);

  useEffect(() => {
    const syncSaved = () => setSavedRecords(savedWordsAdapter.list());
    window.addEventListener(SAVED_WORDS_EVENT, syncSaved);
    return () => window.removeEventListener(SAVED_WORDS_EVENT, syncSaved);
  }, []);

  const topicsQuery = useQuery({
    queryKey: ['topics'],
    queryFn: () => vocabularyApi.listTopics(),
    staleTime: 10 * 60_000,
  });

  const baselineQuery = useQuery({
    queryKey: ['vocabularies', 'baseline'],
    queryFn: () => vocabularyApi.searchVocabularies({ limit: 100 }),
    staleTime: 5 * 60_000,
  });

  const searchQuery = useQuery({
    queryKey: [
      'vocabularies',
      'search',
      debouncedQuery,
      selectedLevel,
      selectedPos,
      selectedTopicId,
      limit,
    ],
    queryFn: () =>
      vocabularyApi.searchVocabularies({
        q: debouncedQuery,
        level: selectedLevel,
        partOfSpeech: selectedPos,
        topicId: selectedTopicId,
        page: 1,
        limit,
      }),
  });

  const savedIdSet = useMemo(
    () => new Set(savedRecords.map((item) => item.vocabularyId)),
    [savedRecords],
  );

  const displayedItems = useMemo<VocabularyItem[]>(() => {
    const rawItems = searchQuery.data?.items ?? [];
    if (!onlySaved) return rawItems;
    return rawItems.filter(
      (item) =>
        savedIdSet.has(item.id) &&
        matchesVietnameseOrEnglish(item.word, item.vietnameseMeaning, debouncedQuery),
    );
  }, [debouncedQuery, onlySaved, savedIdSet, searchQuery.data?.items]);

  const selectedVocab = useMemo<VocabularyItem | null>(() => {
    if (displayedItems.length === 0) return null;
    if (selectedWordId !== null) {
      const found = displayedItems.find((item) => item.id === selectedWordId);
      if (found) return found;
    }
    return displayedItems[0];
  }, [displayedItems, selectedWordId]);

  const spellingSuggestions = useMemo(() => {
    if (displayedItems.length > 0 || !debouncedQuery.trim()) return [];
    const pool = (baselineQuery.data?.items ?? []).map((item) => item.word);
    return computeSpellingSuggestions(debouncedQuery, pool, 4);
  }, [baselineQuery.data?.items, debouncedQuery, displayedItems.length]);

  const relatedWords = useMemo(() => {
    if (!selectedVocab) return [];
    return (baselineQuery.data?.items ?? [])
      .filter((item) => item.topicId === selectedVocab.topicId && item.id !== selectedVocab.id)
      .slice(0, 4);
  }, [baselineQuery.data?.items, selectedVocab]);

  function handleQueryChange(nextVal: string) {
    setQueryText(nextVal);
    if (nextVal.trim()) {
      setSearchParams({ q: nextVal }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  function handleToggleBookmark(item: VocabularyItem) {
    const { saved, items } = savedWordsAdapter.toggle(item);
    setSavedRecords(items);
    showToast(
      saved ? `Đã lưu "${item.word}" vào Sổ từ đã lưu.` : `Đã bỏ lưu "${item.word}".`,
      saved ? 'success' : 'info',
    );
  }

  async function handleCopyWord(word: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(word);
      }
      showToast(`Đã sao chép "${word}"`, 'success');
    } catch {
      showToast('Không thể sao chép từ lúc này.', 'error');
    }
  }

  const totalCount = searchQuery.data?.total ?? displayedItems.length;
  const hasMore = !onlySaved && displayedItems.length < totalCount;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-slate-900">
            Từ điển Oxford 3000
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Tra cứu nhanh tiếng Anh & tiếng Việt không dấu, lọc đa tiêu chí CEFR / Loại từ / Chủ đề và lưu vào Sổ từ.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOnlySaved((prev) => !prev)}
          aria-pressed={onlySaved}
          className={`inline-flex shrink-0 items-center gap-2 self-start rounded-xl border px-4 py-2 text-xs font-bold transition sm:self-auto ${
            onlySaved
              ? 'border-amber-300 bg-amber-50 text-amber-900'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Bookmark className="h-4 w-4" />
          <span>Sổ từ đã lưu ({savedRecords.length})</span>
        </button>
      </header>

      {/* Search & Multi-Criteria Filters */}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 focus-within:border-indigo-500 focus-within:bg-white">
          <Search className="h-4.5 w-4.5 shrink-0 text-slate-400" />
          <input
            type="search"
            aria-label="Tìm kiếm từ điển"
            value={queryText}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Nhập từ tiếng Anh hoặc nghĩa tiếng Việt không dấu (vd: environment, moi truong)..."
            className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc CEFR">
            {CEFR_FILTERS.map((opt) => {
              const active = selectedLevel === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setSelectedLevel(opt.value)}
                  aria-pressed={active}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Lọc theo loại từ"
              value={selectedPos}
              onChange={(e) => setSelectedPos(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
            >
              {POS_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Lọc theo chủ đề từ điển"
              value={selectedTopicId ?? ''}
              onChange={(e) =>
                setSelectedTopicId(e.target.value ? Number(e.target.value) : null)
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-400"
            >
              <option value="">Tất cả chủ đề</option>
              {(topicsQuery.data ?? []).map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Main Split View */}
      {searchQuery.isError ? (
        <ErrorRetryBox
          message="Không thể tải dữ liệu từ điển lúc này. Vui lòng thử lại."
          onRetry={() => void searchQuery.refetch()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Results List */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs lg:col-span-5">
            <div className="mb-3 flex items-center justify-between px-1 text-xs font-semibold text-slate-500">
              <span>{displayedItems.length} kết quả hiển thị</span>
              {onlySaved && <span className="text-amber-700">Đang xem Sổ từ đã lưu</span>}
            </div>

            {searchQuery.isLoading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : displayedItems.length === 0 ? (
              <div className="space-y-4">
                {spellingSuggestions.length > 0 && (
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-indigo-800">
                      <Sparkles className="h-4 w-4" />
                      <span>Có phải bạn muốn tìm:</span>
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {spellingSuggestions.map((word) => (
                        <button
                          key={word}
                          type="button"
                          onClick={() => handleQueryChange(word)}
                          className="rounded-xl border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 transition hover:bg-indigo-600 hover:text-white"
                        >
                          {word}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <EmptyState
                  title="Không tìm thấy từ vựng phù hợp"
                  description="Thử từ khóa khác, tìm tiếng Việt không dấu hoặc đặt lại bộ lọc CEFR/Loại từ."
                />
              </div>
            ) : (
              <div className="max-h-[580px] space-y-2 overflow-y-auto pr-1">
                {displayedItems.map((item) => {
                  const isSelected = selectedVocab?.id === item.id;
                  const isBookmarked = savedIdSet.has(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedWordId(item.id)}
                      className={`flex w-full items-start justify-between gap-3 rounded-xl border p-3.5 text-left transition ${
                        isSelected
                          ? 'border-indigo-400 bg-indigo-50/70'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <strong className="font-heading text-sm font-extrabold text-slate-900">
                            {item.word}
                          </strong>
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                            {item.cefrLevel}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            ({item.partOfSpeech})
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-600">
                          {item.vietnameseMeaning}
                        </p>
                      </div>
                      {isBookmarked && (
                        <BookmarkCheck
                          aria-label="Đã lưu"
                          className="h-4 w-4 shrink-0 text-amber-600"
                        />
                      )}
                    </button>
                  );
                })}

                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setLimit((prev) => prev + 20)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Tải thêm kết quả
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Right Sticky Detail Panel */}
          <section className="lg:col-span-7">
            {selectedVocab ? (
              <article className="sticky top-20 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                        {selectedVocab.cefrLevel}
                      </span>
                      {selectedVocab.partOfSpeech
                        .split(',')
                        .map((pos) => pos.trim())
                        .filter(Boolean)
                        .map((pos) => (
                          <span
                            key={pos}
                            className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700"
                          >
                            {pos}
                          </span>
                        ))}
                      {selectedVocab.topicName && (
                        <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                          {selectedVocab.topicName}
                        </span>
                      )}
                    </div>

                    <h2 className="mt-3 font-heading text-3xl font-extrabold text-slate-900">
                      {selectedVocab.word}
                    </h2>
                    <p className="mt-1 font-mono text-sm text-slate-500">
                      {selectedVocab.phonetic}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleBookmark(selectedVocab)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
                        savedIdSet.has(selectedVocab.id)
                          ? 'border-amber-300 bg-amber-50 text-amber-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {savedIdSet.has(selectedVocab.id) ? (
                        <>
                          <BookmarkCheck className="h-4 w-4" />
                          <span>Đã lưu trong Sổ từ</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="h-4 w-4" />
                          <span>Lưu vào Sổ từ</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleCopyWord(selectedVocab.word)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-4 w-4" />
                      <span>Sao chép</span>
                    </button>
                  </div>
                </div>

                {/* Audio Controls */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void play({
                        word: selectedVocab.word,
                        audioUrl: selectedVocab.audioUrl,
                        rate: 1,
                        accent: 'en-US',
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                  >
                    <Volume2 className="h-4 w-4" />
                    <span>Phát âm US 1.0×</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void play({
                        word: selectedVocab.word,
                        audioUrl: selectedVocab.audioUrl,
                        rate: 0.7,
                        accent: 'en-GB',
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    <Volume2 className="h-4 w-4" />
                    <span>Phát âm UK chậm 0.7×</span>
                  </button>
                </div>

                {/* Meaning & Highlighted Example */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    Nghĩa tiếng Việt
                  </p>
                  <p className="mt-1 font-heading text-xl font-extrabold text-slate-900">
                    {selectedVocab.vietnameseMeaning}
                  </p>

                  <div className="mt-4 border-t border-slate-200/70 pt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Câu ví dụ song ngữ
                    </p>
                    <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-800">
                      {highlightWordInExample(selectedVocab.exampleEn, selectedVocab.word).map(
                        (token, idx) =>
                          token.highlight ? (
                            <mark
                              key={idx}
                              className="rounded bg-indigo-100 px-1 py-0.5 font-bold text-indigo-900"
                            >
                              {token.text}
                            </mark>
                          ) : (
                            <span key={idx}>{token.text}</span>
                          ),
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">{selectedVocab.exampleVi}</p>
                  </div>
                </div>

                {/* Related words in same topic */}
                {relatedWords.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Từ cùng chủ đề ({selectedVocab.topicName})
                    </h3>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {relatedWords.map((rel) => (
                        <button
                          key={rel.id}
                          type="button"
                          onClick={() => setSelectedWordId(rel.id)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                        >
                          {rel.word} — {rel.vietnameseMeaning}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ) : (
              <EmptyState
                title="Chọn một từ để xem chi tiết"
                description="Nghĩa tiếng Việt, phiên âm IPA, phát âm US/UK và câu ví dụ song ngữ sẽ hiển thị tại đây."
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
