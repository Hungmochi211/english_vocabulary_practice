import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import { vocabularyApi } from '@/services/api/vocabulary.api';
import { learningApi } from '@/services/api/learning.api';
import { useVocabularyAudio } from '@/hooks/useVocabularyAudio';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ErrorRetryBox, Skeleton, useToast } from '@/components/common/CommonUi';
import { ApiError } from '@/services/api/httpClient';
import { historyAdapter } from '@/services/adapters/history.adapter';
import { notificationsAdapter } from '@/services/adapters/notifications.adapter';

function HighlightedSentence({ sentence, word }: { sentence: string; word: string }) {
  if (!word.trim()) return <>{sentence}</>;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = sentence.split(regex);
  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === word.toLowerCase() ? (
          <mark
            key={idx}
            className="rounded bg-indigo-100 px-1 py-0.5 font-bold text-indigo-900"
          >
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        ),
      )}
    </>
  );
}

export function LessonStudyPage() {
  const { lessonId: rawLessonId } = useParams();
  const lessonId = Number(rawLessonId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { play } = useVocabularyAudio();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [openedIds, setOpenedIds] = useState<number[]>([]);

  const detailQuery = useQuery({
    queryKey: ['lessons', 'detail', lessonId],
    queryFn: () => vocabularyApi.getLessonDetail(lessonId),
    enabled: Number.isFinite(lessonId) && lessonId > 0,
  });

  useEffect(() => {
    if (detailQuery.data?.openedVocabularyIds) {
      setOpenedIds(detailQuery.data.openedVocabularyIds);
    }
  }, [detailQuery.data]);

  const openCardMutation = useMutation({
    mutationFn: (vocabularyId: number) => learningApi.openCard(lessonId, vocabularyId),
    onSuccess: (updatedLesson, vocabularyId) => {
      setOpenedIds((prev) => (prev.includes(vocabularyId) ? prev : [...prev, vocabularyId]));
      void queryClient.invalidateQueries({ queryKey: ['learning', 'lessons'] });
      if (updatedLesson.acquisitionCompleted) {
        showToast('Bạn đã mở đủ 100% thẻ từ! Có thể chuyển sang Thực hành Bước 2.', 'success');
        historyAdapter.record({
          type: 'study',
          title: `Bước 1: ${detailQuery.data?.title ?? `Bài #${lessonId}`}`,
          correct: updatedLesson.openedCount,
          total: updatedLesson.wordCount,
          accuracy: 100,
          xp: 15,
          duration: '01:00',
          words: (detailQuery.data?.vocabularies ?? []).map((v) => ({
            vocabularyId: v.id,
            word: v.word,
            phonetic: v.phonetic,
            meaning: v.vietnameseMeaning,
            ok: true,
          })),
        });
        notificationsAdapter.push({
          title: 'Hoàn tất Bước 1 — Học thẻ',
          body: `Bạn đã mở đủ 100% thẻ của bài "${detailQuery.data?.title ?? `#${lessonId}`}". Sẵn sàng Thực hành Bước 2!`,
          icon: 'book',
          tone: 'blue',
          targetRoute: `/courses/${lessonId}/practice`,
        });
      }
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Không thể ghi nhận trạng thái mở thẻ lúc này.';
      showToast(msg, 'error');
    },
  });

  const vocabularies = detailQuery.data?.vocabularies ?? [];
  const currentVocab = vocabularies[currentIndex];
  const wordCount = detailQuery.data?.wordCount ?? vocabularies.length;
  const openedCount = openedIds.length;
  const acquisitionCompleted = wordCount > 0 && openedCount >= wordCount;
  const remainingCards = Math.max(0, wordCount - openedCount);

  const posBadges = useMemo(() => {
    if (!currentVocab?.partOfSpeech) return [];
    return currentVocab.partOfSpeech
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }, [currentVocab?.partOfSpeech]);

  function handleFlipCard() {
    if (!currentVocab) return;
    const nextFlipped = !isFlipped;
    setIsFlipped(nextFlipped);
    if (nextFlipped && !openedIds.includes(currentVocab.id)) {
      openCardMutation.mutate(currentVocab.id);
    }
  }

  function handleSelectIndex(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= vocabularies.length) return;
    setCurrentIndex(nextIndex);
    setIsFlipped(false);
  }

  useKeyboardShortcuts({
    onSpace: handleFlipCard,
    enabled: Boolean(currentVocab),
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-80 w-full rounded-3xl" />
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <ErrorRetryBox
        message="Không thể tải nội dung thẻ từ vựng cho bài học này."
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }

  const progressPercent = wordCount > 0 ? Math.round((openedCount / wordCount) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header & Step Progress */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/courses"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Lộ trình</span>
          </Link>
          <h1 className="mt-1 font-heading text-2xl font-extrabold text-slate-900">
            Bước 1 — Học nạp Flashcard: {detailQuery.data.title}
          </h1>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-right">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Thẻ đã mở
          </span>
          <strong data-testid="study-progress" className="font-heading text-lg font-extrabold text-indigo-700">
            {openedCount} / {wordCount}
          </strong>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
          <span>
            Thẻ {currentIndex + 1} / {vocabularies.length}
          </span>
          <span>{progressPercent}% hoàn tất Bước 1</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 3D Flip Flashcard */}
      {currentVocab && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">
                {currentVocab.cefrLevel}
              </span>
              {posBadges.map((pos) => (
                <span
                  key={pos}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700"
                >
                  {pos}
                </span>
              ))}
            </div>

            {openedIds.includes(currentVocab.id) ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>Đã ghi nhận mở thẻ</span>
              </span>
            ) : (
              <span className="text-xs font-medium text-slate-400">Nhấn Lật thẻ hoặc Space để xem nghĩa</span>
            )}
          </div>

          <div className="my-8 text-center">
            <h2 className="font-heading text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              {currentVocab.word}
            </h2>
            <p className="mt-2 font-mono text-base text-slate-500">{currentVocab.phonetic}</p>

            {/* 2-Speed Audio Controls */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() =>
                  void play({
                    word: currentVocab.word,
                    audioUrl: currentVocab.audioUrl,
                    rate: 1,
                    accent: 'en-US',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
              >
                <Volume2 className="h-4 w-4" />
                <span>Nghe chuẩn 1.0×</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  void play({
                    word: currentVocab.word,
                    audioUrl: currentVocab.audioUrl,
                    rate: 0.7,
                    accent: 'en-GB',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
              >
                <Volume2 className="h-4 w-4" />
                <span>Nghe chậm 0.7×</span>
              </button>
            </div>
          </div>

          {/* Back of Card */}
          {isFlipped ? (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 text-left">
              <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">Nghĩa tiếng Việt</p>
              <p className="mt-1 font-heading text-xl font-bold text-slate-900">
                {currentVocab.vietnameseMeaning}
              </p>

              <div className="mt-4 border-t border-indigo-100 pt-3">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ví dụ ngữ cảnh</p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  <HighlightedSentence sentence={currentVocab.exampleEn} word={currentVocab.word} />
                </p>
                <p className="mt-1 text-xs text-slate-600">{currentVocab.exampleVi}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-500">
              Lật thẻ để xem nghĩa tiếng Việt, câu ví dụ song ngữ và đánh dấu hoàn thành thẻ này.
            </div>
          )}

          {/* Flip & Prev/Next Controls */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => handleSelectIndex(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Thẻ trước</span>
            </button>

            <button
              type="button"
              onClick={handleFlipCard}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
            >
              <RotateCcw className="h-4 w-4" />
              <span>{isFlipped ? 'Úp thẻ lại' : 'Lật thẻ / Xem nghĩa'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectIndex(currentIndex + 1)}
              disabled={currentIndex >= vocabularies.length - 1}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Thẻ tiếp theo</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* Step 2 Gate Footer */}
      <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-heading text-base font-bold text-slate-900">
            Cổng chuyển sang Bước 2 (Thực hành)
          </h3>
          <p className="mt-0.5 text-xs text-slate-600">
            {acquisitionCompleted
              ? 'Tuyệt vời! Bạn đã mở đủ 100% thẻ từ và sẵn sàng làm bài kiểm tra đạt ≥ 80%.'
              : `Còn ${remainingCards} thẻ chưa mở. Hãy mở hết tất cả thẻ để kích hoạt nút Thực hành.`}
          </p>
        </div>

        <button
          type="button"
          disabled={!acquisitionCompleted}
          onClick={() => navigate(`/courses/${lessonId}/practice`)}
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${
            acquisitionCompleted
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'cursor-not-allowed bg-slate-200 text-slate-500'
          }`}
        >
          {!acquisitionCompleted && <Lock className="h-4 w-4" />}
          <span>Chuyển sang Thực hành (Bước 2)</span>
        </button>
      </section>
    </div>
  );
}
