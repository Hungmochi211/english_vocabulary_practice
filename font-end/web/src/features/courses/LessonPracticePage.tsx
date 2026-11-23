import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  RefreshCw,
  Volume2,
  XCircle,
} from 'lucide-react';
import { learningApi } from '@/services/api/learning.api';
import { ApiError } from '@/services/api/httpClient';
import { invalidateLearningCaches } from '@/app/queryClient';
import { clampResponseTimeMs } from '@/utils/formatters';
import { getGradingFeedbackMeta } from '@/utils/gradingFeedback';
import { useVocabularyAudio } from '@/hooks/useVocabularyAudio';
import { ErrorRetryBox, Skeleton, useToast } from '@/components/common/CommonUi';
import { historyAdapter } from '@/services/adapters/history.adapter';
import { notificationsAdapter } from '@/services/adapters/notifications.adapter';
import type {
  QuizAnswerSubmission,
  QuizAttemptStart,
  QuizSubmitResult,
} from '@/types/models';

export function LessonPracticePage() {
  const { lessonId: rawLessonId } = useParams();
  const lessonId = Number(rawLessonId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { play } = useVocabularyAudio();

  const [attempt, setAttempt] = useState<QuizAttemptStart | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ code?: string; message: string } | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [responseTimes, setResponseTimes] = useState<Record<number, number>>({});
  const questionStartRef = useRef<number>(Date.now());

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<QuizSubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const startAttempt = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSubmitResult(null);
    setSubmitError(null);
    setCurrentIndex(0);
    setAnswers({});
    setResponseTimes({});
    try {
      const started = await learningApi.startLessonPractice(lessonId);
      setAttempt(started);
      questionStartRef.current = Date.now();
    } catch (err) {
      if (err instanceof ApiError) {
        setLoadError({ code: err.code, message: err.message });
      } else {
        setLoadError({ message: 'Không thể khởi tạo phiên thực hành Bước 2. Vui lòng thử lại.' });
      }
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    if (Number.isFinite(lessonId) && lessonId > 0) {
      void startAttempt();
    }
  }, [lessonId, startAttempt]);

  const questions = attempt?.questions ?? [];
  const currentQuestion = questions[currentIndex];

  function recordCurrentTime(): Record<number, number> {
    if (!currentQuestion) return responseTimes;
    const elapsed = clampResponseTimeMs(Date.now() - questionStartRef.current);
    const updated = {
      ...responseTimes,
      [currentQuestion.vocabularyId]: (responseTimes[currentQuestion.vocabularyId] ?? 0) + elapsed,
    };
    setResponseTimes(updated);
    questionStartRef.current = Date.now();
    return updated;
  }

  function handleNextQuestion() {
    recordCurrentTime();
    setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1));
  }

  async function handleSubmit() {
    if (!attempt || submitting) return;
    const latestTimes = recordCurrentTime();
    setSubmitting(true);
    setSubmitError(null);

    const payload: QuizAnswerSubmission[] = attempt.questions.map((q) => ({
      vocabularyId: q.vocabularyId,
      userAnswer: answers[q.vocabularyId]?.trim() || null,
      responseTimeMs: clampResponseTimeMs(latestTimes[q.vocabularyId] ?? 1000),
    }));

    try {
      const result = await learningApi.submitAttempt(attempt.attemptId, payload);
      setSubmitResult(result);
      await invalidateLearningCaches(queryClient);
      historyAdapter.record({
        type: 'typing',
        title: `Thực hành Bước 2 — Bài #${lessonId}`,
        correct: result.correctCount,
        total: result.totalQuestions,
        accuracy: result.scorePercent,
        xp: result.xpEarned,
        duration: '01:30',
        words: result.results.map((r) => ({
          vocabularyId: r.vocabularyId,
          word: r.word,
          phonetic: r.phonetic,
          meaning: r.vietnameseMeaning,
          ok: r.gradingStatus === 'exact',
        })),
      });
      notificationsAdapter.push({
        title: result.passed ? 'Đạt Thực hành Bước 2!' : 'Hoàn tất Thực hành Bước 2',
        body: result.passed
          ? `Bạn đạt ${result.scorePercent}% (+${result.xpEarned} XP) và mở khóa bài kế tiếp.`
          : `Bạn đạt ${result.scorePercent}%. Ôn lại các từ sai để vượt ngưỡng 80% nhé.`,
        icon: 'trophy',
        tone: result.passed ? 'green' : 'amber',
        targetRoute: '/history',
      });
      showToast(
        result.passed
          ? `Xuất sắc! Đạt ${result.scorePercent}% (+${result.xpEarned} XP)`
          : `Đạt ${result.scorePercent}%. Ôn lại các từ sai và thử lại nhé!`,
        result.passed ? 'success' : 'info',
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ATTEMPT_ALREADY_SUBMITTED') {
        setSubmitError(err.message);
      } else if (err instanceof ApiError) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Không thể nộp bài lúc này. Vui lòng thử lại.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <ErrorRetryBox message={loadError.message} onRetry={() => void startAttempt()} />
        {(loadError.code === 'ACQUISITION_INCOMPLETE' || loadError.code === 'LESSON_LOCKED') && (
          <div className="text-center">
            <Link
              to={`/courses/${lessonId}/study`}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Quay về Bước 1 để mở đủ thẻ</span>
            </Link>
          </div>
        )}
      </div>
    );
  }

  if (submitResult) {
    const missedResults = submitResult.results.filter((r) => r.gradingStatus !== 'exact');
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <section
          className={`rounded-3xl border p-6 text-center shadow-xs sm:p-8 ${
            submitResult.passed
              ? 'border-emerald-200 bg-emerald-50/70'
              : 'border-amber-200 bg-amber-50/70'
          }`}
        >
          <div
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
              submitResult.passed ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
            }`}
          >
            {submitResult.passed ? <Award className="h-7 w-7" /> : <XCircle className="h-7 w-7" />}
          </div>

          <h1 className="mt-4 font-heading text-2xl font-extrabold text-slate-900">
            {submitResult.passed ? 'Hoàn thành xuất sắc Bước 2!' : 'Chưa đạt ngưỡng 80%'}
          </h1>

          <p className="mt-1 font-heading text-4xl font-extrabold text-slate-900">
            {submitResult.scorePercent}%
          </p>

          <p className="mt-2 text-sm font-medium text-slate-700">
            Đúng hoàn toàn {submitResult.correctCount}/{submitResult.totalQuestions} câu • Nhận{' '}
            <strong className="text-indigo-700">+{submitResult.xpEarned} XP</strong>
          </p>

          {submitResult.nextLessonUnlockedId && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Đã mở khóa bài học kế tiếp trên Lộ trình!</span>
            </div>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {!submitResult.passed && (
              <button
                type="button"
                onClick={() => void startAttempt()}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Làm lại bài thực hành</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/courses')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Quay lại Lộ trình</span>
            </button>
          </div>
        </section>

        {/* Detailed Graded Word Breakdown */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-heading text-lg font-extrabold text-slate-900">
            Chi tiết chấm điểm ({missedResults.length > 0 ? `${missedResults.length} từ cần chú ý` : 'Hoàn hảo'})
          </h2>
          <div className="mt-4 divide-y divide-slate-100">
            {submitResult.results.map((item) => {
              const meta = getGradingFeedbackMeta(item.gradingStatus);
              return (
                <div
                  key={item.vocabularyId}
                  className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="font-heading text-base text-slate-900">{item.word}</strong>
                      {item.phonetic && (
                        <span className="font-mono text-xs text-slate-500">{item.phonetic}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      Câu trả lời của bạn: <strong>{item.userAnswer || '(Bỏ trống)'}</strong> — {item.feedbackMessage}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-bold ${meta.badgeClass}`}
                  >
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to={`/courses/${lessonId}/study`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại Bước 1</span>
          </Link>
          <h1 className="mt-1 font-heading text-2xl font-extrabold text-slate-900">
            Thực hành Bước 2 (Cần đạt ≥ 80%)
          </h1>
        </div>
        <span className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
          Câu {currentIndex + 1} / {questions.length}
        </span>
      </div>

      {submitError && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {submitError}
        </div>
      )}

      {currentQuestion && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span className="rounded-md bg-slate-100 px-2.5 py-1 uppercase">
              {currentQuestion.practiceMode === 'dictation'
                ? 'Nghe chép chính tả'
                : currentQuestion.practiceMode === 'multiple_choice'
                  ? 'Trắc nghiệm 4 đáp án'
                  : 'Gõ từ tiếng Anh'}
            </span>
            {currentQuestion.prompt.partOfSpeech && <span>({currentQuestion.prompt.partOfSpeech})</span>}
          </div>

          <div className="mt-5 space-y-3">
            {currentQuestion.prompt.vietnameseMeaning && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Nghĩa tiếng Việt</p>
                <p className="mt-1 font-heading text-xl font-extrabold text-slate-900">
                  {currentQuestion.prompt.vietnameseMeaning}
                </p>
              </div>
            )}

            {currentQuestion.prompt.clozeExampleEn && (
              <p className="rounded-xl bg-slate-50 p-3.5 text-sm text-slate-700">
                {currentQuestion.prompt.clozeExampleEn}
              </p>
            )}

            {currentQuestion.practiceMode === 'dictation' && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void play({
                      word: currentQuestion.prompt.word ?? currentQuestion.prompt.vietnameseMeaning ?? '',
                      audioUrl: currentQuestion.prompt.audioUrl,
                      rate: 1,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700"
                >
                  <Volume2 className="h-4 w-4" />
                  <span>Nghe phát âm 1.0×</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void play({
                      word: currentQuestion.prompt.word ?? currentQuestion.prompt.vietnameseMeaning ?? '',
                      audioUrl: currentQuestion.prompt.audioUrl,
                      rate: 0.7,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700"
                >
                  <Volume2 className="h-4 w-4" />
                  <span>Chậm 0.7×</span>
                </button>
              </div>
            )}

            {currentQuestion.practiceMode === 'multiple_choice' && currentQuestion.prompt.options ? (
              <div className="grid grid-cols-1 gap-2.5 pt-2 sm:grid-cols-2">
                {currentQuestion.prompt.options.map((opt, idx) => {
                  const selected = answers[currentQuestion.vocabularyId] === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => ({ ...prev, [currentQuestion.vocabularyId]: opt }))
                      }
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
                        selected
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="mr-2 font-mono text-xs text-slate-400">{idx + 1}.</span>
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="pt-2">
                <label
                  htmlFor="lesson-practice-input"
                  className="mb-1.5 block text-xs font-bold text-slate-700"
                >
                  Nhập từ tiếng Anh
                </label>
                <input
                  id="lesson-practice-input"
                  type="text"
                  autoComplete="off"
                  value={answers[currentQuestion.vocabularyId] ?? ''}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [currentQuestion.vocabularyId]: e.target.value,
                    }))
                  }
                  placeholder="Gõ từ vựng tương ứng..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
            {currentIndex < questions.length - 1 ? (
              <button
                type="button"
                onClick={handleNextQuestion}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                <span>Câu tiếp theo</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmit()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <span>{submitting ? 'Đang chấm điểm...' : 'Nộp bài & Chấm điểm'}</span>
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
