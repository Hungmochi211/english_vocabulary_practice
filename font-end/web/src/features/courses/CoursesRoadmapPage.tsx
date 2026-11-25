import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, CheckCircle2, Lock, PlayCircle, Sparkles } from 'lucide-react';
import { learningApi } from '@/services/api/learning.api';
import { vocabularyApi } from '@/services/api/vocabulary.api';
import { EmptyState, ErrorRetryBox, Skeleton } from '@/components/common/CommonUi';
import { CustomSelect } from '@/components/common/CustomSelect';
import type { CefrLevel } from '@/types/models';

const CEFR_OPTIONS: Array<{ value: CefrLevel | ''; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'A1', label: 'A1' },
  { value: 'A2', label: 'A2' },
  { value: 'B1', label: 'B1' },
  { value: 'B2', label: 'B2' },
];

export function CoursesRoadmapPage() {
  const [selectedLevel, setSelectedLevel] = useState<CefrLevel | ''>('');
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);

  const topicsQuery = useQuery({
    queryKey: ['topics'],
    queryFn: () => vocabularyApi.listTopics(),
    staleTime: 10 * 60_000,
  });

  const lessonsQuery = useQuery({
    queryKey: ['learning', 'lessons', selectedLevel, selectedTopicId],
    queryFn: () => learningApi.listLessons({ level: selectedLevel, topicId: selectedTopicId }),
  });

  const topics = topicsQuery.data ?? [];
  const lessons = lessonsQuery.data ?? [];

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-[#f8fafc]">
      <header className="flex flex-col justify-between gap-4 px-5 pt-6 pb-2 sm:flex-row sm:items-center sm:px-7 sm:pt-7">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-slate-900">Khóa học & Lộ trình học</h1>
          <p className="mt-1 text-sm text-slate-600">
            Học theo chu trình 2 bước: Mở 100% thẻ Flashcard (Bước 1) → Thực hành đạt ≥ 80% (Bước 2) để mở khóa bài tiếp theo.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 sm:self-auto">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{lessons.length} bài học</span>
        </span>
      </header>

      <div className="space-y-5 px-5 pt-4 pb-6 sm:px-7">
        {/* Filter Bar: CEFR + Topic */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo trình độ">
          {CEFR_OPTIONS.map((opt) => {
            const active = selectedLevel === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setSelectedLevel(opt.value)}
                aria-pressed={active}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  active
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="topic-filter" className="text-xs font-semibold text-slate-600">
            Chủ đề:
          </label>
          <CustomSelect
            id="topic-filter"
            ariaLabel="Lọc theo chủ đề"
            value={selectedTopicId ? String(selectedTopicId) : ''}
            onChange={(val) => setSelectedTopicId(val ? Number(val) : null)}
            options={[
              { value: '', label: 'Tất cả chủ đề' },
              ...topics.map((topic) => ({ value: String(topic.id), label: topic.name })),
            ]}
            align="right"
          />
        </div>
      </section>

      {/* Lessons List */}
      {lessonsQuery.isError ? (
        <ErrorRetryBox
          message="Không thể tải danh sách bài học. Vui lòng thử lại."
          onRetry={() => void lessonsQuery.refetch()}
        />
      ) : lessonsQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-3 h-6 w-3/4" />
              <Skeleton className="mt-4 h-3 w-full" />
              <Skeleton className="mt-4 h-9 w-36" />
            </div>
          ))}
        </div>
      ) : lessons.length === 0 ? (
        <EmptyState
          title="Không tìm thấy bài học phù hợp"
          description="Thử chọn trình độ hoặc chủ đề khác để tiếp tục hành trình học từ vựng."
          action={
            <button
              type="button"
              onClick={() => {
                setSelectedLevel('');
                setSelectedTopicId(null);
              }}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Đặt lại bộ lọc
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {lessons.map((lesson) => {
            const openPercent =
              lesson.wordCount > 0 ? Math.round((lesson.openedCount / lesson.wordCount) * 100) : 0;

            return (
              <article
                key={lesson.lessonId}
                className={`flex flex-col justify-between rounded-2xl border p-5 transition ${
                  lesson.isUnlocked
                    ? 'border-slate-200 bg-white shadow-2xs hover:border-indigo-200'
                    : 'border-slate-200/80 bg-slate-50/90 opacity-85'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-700">
                        {lesson.cefrLevel}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {lesson.topicName}
                      </span>
                    </div>

                    {lesson.isCompleted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Đã hoàn thành</span>
                      </span>
                    ) : lesson.isUnlocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Đã mở khóa</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/80 px-2.5 py-1 text-xs font-bold text-slate-600">
                        <Lock className="h-3.5 w-3.5" />
                        <span>Đang khóa</span>
                      </span>
                    )}
                  </div>

                  <h2 className="mt-3 font-heading text-lg font-extrabold text-slate-900">
                    Bài {lesson.orderIndex}: {lesson.title}
                  </h2>

                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>Tiến độ Bước 1 (Mở thẻ)</span>
                      <span>
                        {lesson.openedCount} / {lesson.wordCount} từ ({openPercent}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all"
                        style={{ width: `${openPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Điểm Bước 2 cao nhất:{' '}
                      <strong className="text-slate-800">
                        {lesson.bestScore !== null ? `${lesson.bestScore}%` : 'Chưa làm'}
                      </strong>
                    </span>
                    {!lesson.isUnlocked && <span>Đạt ≥ 80% bài trước để mở</span>}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2.5 border-t border-slate-100 pt-4">
                  {lesson.isUnlocked ? (
                    <>
                      <Link
                        to={`/courses/${lesson.lessonId}/study`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Học thẻ (Bước 1)</span>
                      </Link>
                      {lesson.acquisitionCompleted ? (
                        <Link
                          to={`/courses/${lesson.lessonId}/practice`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          <span>Thực hành (Bước 2)</span>
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-500">
                          <Lock className="h-3.5 w-3.5" />
                          <span>Mở đủ thẻ để Thực hành</span>
                        </span>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-400"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      <span>Cần hoàn thành bài trước (≥ 80%)</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
