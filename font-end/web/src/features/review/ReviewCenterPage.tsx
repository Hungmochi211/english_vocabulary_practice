import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Award,
  Bookmark,
  BookOpen,
  Clock,
  Headphones,
  Keyboard,
  Layers,
  ListChecks,
  RefreshCw,
  Search,
  Shuffle,
} from 'lucide-react';
import { reviewApi } from '@/services/api/review.api';
import { learningApi } from '@/services/api/learning.api';
import { statsApi } from '@/services/api/stats.api';
import { ApiError } from '@/services/api/httpClient';
import { invalidateLearningCaches } from '@/app/queryClient';
import { clampResponseTimeMs } from '@/utils/formatters';
import { getGradingFeedbackMeta, gradeLocalAnswer } from '@/utils/gradingFeedback';
import { ErrorRetryBox, Skeleton, useToast } from '@/components/common/CommonUi';
import { LeitnerBoxesBar } from '@/features/review/LeitnerBoxesBar';
import { SrsFlashcardStage } from '@/features/review/modes/SrsFlashcardStage';
import { QuizQuestionStage } from '@/features/review/modes/QuizQuestionStage';
import { TypingQuestionStage } from '@/features/review/modes/TypingQuestionStage';
import { DictationQuestionStage } from '@/features/review/modes/DictationQuestionStage';
import {
  SAVED_WORDS_EVENT,
  savedWordsAdapter,
} from '@/services/adapters/savedWords.adapter';
import { historyAdapter } from '@/services/adapters/history.adapter';
import { notificationsAdapter } from '@/services/adapters/notifications.adapter';
import type {
  DueReviewItem,
  GradedAnswerResult,
  LeitnerDistribution,
  QuizAnswerSubmission,
  QuizAttemptStart,
  QuizQuestion,
  QuizSubmitResult,
  ReviewSessionOrigin,
  SavedWordRecord,
} from '@/types/models';

const FALLBACK_QUIZ_DISTRACTORS = [
  'achieve',
  'balance',
  'climate',
  'discover',
  'energy',
  'freedom',
  'horizon',
  'inspire',
  'journey',
  'library',
  'natural',
  'protect',
];

function deriveLeitnerFromDueItems(items: DueReviewItem[]): LeitnerDistribution {
  const dist: LeitnerDistribution = { box1: 0, box2: 0, box3: 0, box4: 0, box5: 0 };
  for (const item of items) {
    if (item.leitnerBox === 1) dist.box1 += 1;
    else if (item.leitnerBox === 2) dist.box2 += 1;
    else if (item.leitnerBox === 3) dist.box3 += 1;
    else if (item.leitnerBox === 4) dist.box4 += 1;
    else if (item.leitnerBox === 5) dist.box5 += 1;
  }
  return dist;
}

function buildClientQuizQuestion(
  question: QuizQuestion,
  targetWord: string,
  candidateWords: string[],
  fallbackMeaning?: string,
): QuizQuestion {
  if (question.prompt.options && question.prompt.options.length > 0) {
    return question;
  }
  const cleanTarget = targetWord.trim();
  if (!cleanTarget) return question;

  const distractors: string[] = [];
  const seen = new Set<string>([cleanTarget.toLowerCase()]);
  for (const w of [...candidateWords, ...FALLBACK_QUIZ_DISTRACTORS]) {
    const clean = w.trim();
    const key = clean.toLowerCase();
    if (clean && !seen.has(key)) {
      seen.add(key);
      distractors.push(clean);
      if (distractors.length === 3) break;
    }
  }

  const options = [cleanTarget, ...distractors];
  const shift = question.vocabularyId % options.length;
  const rotated = [...options.slice(shift), ...options.slice(0, shift)];

  return {
    ...question,
    prompt: {
      ...question.prompt,
      word: undefined,
      vietnameseMeaning: question.prompt.vietnameseMeaning || fallbackMeaning,
      options: rotated,
    },
  };
}

type ReviewUiMode = 'srs' | 'quiz' | 'typing' | 'dictation';

interface ActiveSession {
  origin: ReviewSessionOrigin;
  attemptId: number | null;
  title: string;
  uiMode: ReviewUiMode | 'mixed';
  questions: QuizQuestion[];
  targetWordsByVocabId: Record<number, string>;
  dueLookup: Record<number, DueReviewItem>;
}

const MODE_CARDS: Array<{
  id: ReviewUiMode;
  label: string;
  desc: string;
  icon: typeof Layers;
}> = [
  { id: 'srs', label: 'Thẻ ghi nhớ', desc: 'Lật thẻ & tự đánh giá 4 mức nhớ', icon: Layers },
  { id: 'quiz', label: 'Trắc nghiệm', desc: 'Chọn nhanh 1 trong 4 đáp án (phím 1–4)', icon: ListChecks },
  { id: 'typing', label: 'Gõ từ', desc: 'Gõ chính xác từ tiếng Anh theo nghĩa', icon: Keyboard },
  { id: 'dictation', label: 'Nghe chép', desc: 'Nghe US/UK 1.0× / 0.7× và chép lại', icon: Headphones },
];

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ReviewCenterPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [selectedMode, setSelectedMode] = useState<ReviewUiMode>('typing');
  const [selectedBox, setSelectedBox] = useState<number | null>(null);
  const [savedWords, setSavedWords] = useState<SavedWordRecord[]>(() => savedWordsAdapter.list());
  const [starting, setStarting] = useState(false);
  const [session, setSession] = useState<ActiveSession | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [responseTimes, setResponseTimes] = useState<Record<number, number>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const questionStartRef = useRef<number>(Date.now());

  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [summary, setSummary] = useState<QuizSubmitResult | null>(null);

  const dueQuery = useQuery({
    queryKey: ['reviews', 'due'],
    queryFn: () => reviewApi.getDueReviews(),
  });

  const overviewQuery = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => statsApi.getOverview(),
  });

  useEffect(() => {
    const syncSaved = () => setSavedWords(savedWordsAdapter.list());
    window.addEventListener(SAVED_WORDS_EVENT, syncSaved);
    void savedWordsAdapter.syncFromServer();
    return () => window.removeEventListener(SAVED_WORDS_EVENT, syncSaved);
  }, []);

  useEffect(() => {
    const state = location.state as {
      customPractice?: {
        title: string;
        words: Array<{
          vocabularyId: number;
          word: string;
          phonetic: string;
          vietnameseMeaning: string;
        }>;
      };
    } | null;
    if (state?.customPractice && state.customPractice.words.length > 0) {
      const targetWords: Record<number, string> = {};
      const questions: QuizQuestion[] = state.customPractice.words.map((w) => {
        targetWords[w.vocabularyId] = w.word;
        return {
          vocabularyId: w.vocabularyId,
          practiceMode: 'typing',
          prompt: {
            phonetic: w.phonetic,
            vietnameseMeaning: w.vietnameseMeaning,
          },
        };
      });
      initSessionState({
        origin: 'client_custom_practice',
        attemptId: null,
        title: state.customPractice.title,
        uiMode: 'typing',
        questions,
        targetWordsByVocabId: targetWords,
        dueLookup: {},
      });
      navigate('/review', { replace: true, state: null });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    if (!session || summary) return undefined;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [session, summary]);

  const dueItems = dueQuery.data?.items ?? [];
  const dueCount = dueQuery.data?.dueCount ?? 0;
  const distribution: LeitnerDistribution = useMemo(() => {
    if (overviewQuery.data?.leitnerDistribution) {
      return overviewQuery.data.leitnerDistribution;
    }
    if (dueQuery.data?.leitnerDistribution) {
      return dueQuery.data.leitnerDistribution;
    }
    return deriveLeitnerFromDueItems(dueItems);
  }, [dueItems, dueQuery.data?.leitnerDistribution, overviewQuery.data?.leitnerDistribution]);

  const filteredDuePreview = useMemo(() => {
    if (selectedBox === null) return dueItems;
    return dueItems.filter((item) => item.leitnerBox === selectedBox);
  }, [dueItems, selectedBox]);

  const dueLookup = useMemo(() => {
    const map: Record<number, DueReviewItem> = {};
    for (const item of dueItems) {
      map[item.vocabularyId] = item;
    }
    return map;
  }, [dueItems]);

  function initSessionState(nextSession: ActiveSession) {
    setSession(nextSession);
    setSummary(null);
    setAlreadySubmitted(false);
    setSubmitError(null);
    setCurrentIndex(0);
    setAnswers({});
    setResponseTimes({});
    setElapsedSeconds(0);
    questionStartRef.current = Date.now();
  }

  async function handleStartOfficialSm2() {
    if (starting || dueCount === 0) return;
    setStarting(true);
    setSubmitError(null);
    try {
      const attempt: QuizAttemptStart = await reviewApi.startSm2Session(20);
      if (attempt.questions.length === 0) {
        showToast('Hôm nay chưa có từ nào cần ôn tập.', 'info');
        return;
      }
      const targetWords: Record<number, string> = {};
      for (const item of dueItems) {
        targetWords[item.vocabularyId] = item.word;
      }
      initSessionState({
        origin: 'server_official',
        attemptId: attempt.attemptId,
        title: 'Phiên ôn tập hôm nay',
        uiMode: selectedMode,
        questions: attempt.questions,
        targetWordsByVocabId: targetWords,
        dueLookup,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể bắt đầu phiên ôn tập.';
      showToast(msg, 'error');
    } finally {
      setStarting(false);
    }
  }

  async function handleStartMixedQuiz() {
    if (starting) return;
    setStarting(true);
    setSubmitError(null);
    try {
      const attempt = await reviewApi.startMixedQuiz(5);
      initSessionState({
        origin: 'server_official',
        attemptId: attempt.attemptId,
        title: 'Bài kiểm tra tổng hợp',
        uiMode: 'mixed',
        questions: attempt.questions,
        targetWordsByVocabId: {},
        dueLookup,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Không thể khởi tạo Bài kiểm tra tổng hợp.';
      showToast(msg, 'error');
    } finally {
      setStarting(false);
    }
  }

  function handleStartSavedWordsPractice() {
    if (savedWords.length === 0) {
      showToast('Sổ từ đã lưu hiện đang trống. Hãy lưu từ trong mục Tra từ trước.', 'info');
      return;
    }
    const targetWords: Record<number, string> = {};
    const questions: QuizQuestion[] = savedWords.map((item) => {
      targetWords[item.vocabularyId] = item.word;
      return {
        vocabularyId: item.vocabularyId,
        practiceMode: 'typing',
        prompt: {
          phonetic: item.phonetic,
          partOfSpeech: item.partOfSpeech,
          cefrLevel: item.cefrLevel,
          vietnameseMeaning: item.vietnameseMeaning,
        },
      };
    });
    initSessionState({
      origin: 'client_custom_practice',
      attemptId: null,
      title: 'Luyện tập tự chọn — Sổ từ đã lưu',
      uiMode: 'typing',
      questions,
      targetWordsByVocabId: targetWords,
      dueLookup: {},
    });
  }

  function handleRetryMissedWords(missed: GradedAnswerResult[]) {
    if (missed.length === 0) return;
    const questions: QuizQuestion[] = missed.map((item) => ({
      vocabularyId: item.vocabularyId,
      practiceMode: 'typing',
      prompt: {
        phonetic: item.phonetic,
        vietnameseMeaning: item.vietnameseMeaning || `Gõ lại từ "${item.word}"`,
      },
    }));
    const targetWords: Record<number, string> = {};
    for (const item of missed) {
      targetWords[item.vocabularyId] = item.word;
    }
    initSessionState({
      origin: 'client_custom_practice',
      attemptId: null,
      title: 'Luyện tập tự chọn — Ôn lại các từ sai',
      uiMode: 'typing',
      questions,
      targetWordsByVocabId: targetWords,
      dueLookup,
    });
  }

  const currentQuestion = session?.questions[currentIndex];

  function captureCurrentResponseTime(): Record<number, number> {
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
    if (!session) return;
    captureCurrentResponseTime();
    setCurrentIndex((prev) => Math.min(session.questions.length - 1, prev + 1));
  }

  async function submitSession(finalAnswersMap: Record<number, string>) {
    if (!session || submitting || alreadySubmitted) return;
    const latestTimes = captureCurrentResponseTime();
    setSubmitting(true);
    setSubmitError(null);

    if (session.origin === 'client_custom_practice') {
      let totalPoints = 0;
      let exactCount = 0;
      const results: GradedAnswerResult[] = session.questions.map((q) => {
        const targetWord = session.targetWordsByVocabId[q.vocabularyId] ?? '';
        const rawAnswer = finalAnswersMap[q.vocabularyId]?.trim() || null;
        const graded = gradeLocalAnswer(targetWord, rawAnswer);
        totalPoints += graded.pointsAwarded;
        if (graded.gradingStatus === 'exact') exactCount += 1;
        return {
          vocabularyId: q.vocabularyId,
          word: targetWord,
          phonetic: q.prompt.phonetic,
          vietnameseMeaning: q.prompt.vietnameseMeaning,
          userAnswer: rawAnswer,
          gradingStatus: graded.gradingStatus,
          pointsAwarded: graded.pointsAwarded,
          feedbackMessage: graded.feedbackMessage,
        };
      });

      const totalQuestions = Math.max(1, session.questions.length);
      const scorePercent = Math.round((totalPoints / totalQuestions) * 100);
      const localSummary: QuizSubmitResult = {
        attemptId: null,
        origin: 'client_custom_practice',
        scorePercent,
        passed: scorePercent >= 80,
        correctCount: exactCount,
        totalQuestions,
        xpEarned: 0,
        results,
      };
      setSummary(localSummary);
      historyAdapter.record({
        type: 'typing',
        title: session.title,
        correct: exactCount,
        total: totalQuestions,
        accuracy: scorePercent,
        xp: 0,
        duration: formatElapsed(elapsedSeconds),
        words: results.map((r) => ({
          vocabularyId: r.vocabularyId,
          word: r.word,
          phonetic: r.phonetic,
          meaning: r.vietnameseMeaning,
          ok: r.gradingStatus === 'exact',
        })),
      });
      setSubmitting(false);
      return;
    }

    if (session.attemptId === null) {
      setSubmitting(false);
      return;
    }

    const payload: QuizAnswerSubmission[] = session.questions.map((q) => ({
      vocabularyId: q.vocabularyId,
      userAnswer: finalAnswersMap[q.vocabularyId]?.trim().slice(0, 100) || null,
      responseTimeMs: clampResponseTimeMs(latestTimes[q.vocabularyId] ?? 1000),
    }));

    try {
      const result = await learningApi.submitAttempt(session.attemptId, payload);
      setSummary(result);
      await invalidateLearningCaches(queryClient);
      const historyType =
        session.uiMode === 'mixed'
          ? 'quiz'
          : session.uiMode === 'srs'
            ? 'srs'
            : session.uiMode === 'dictation'
              ? 'dictation'
              : session.uiMode === 'quiz'
                ? 'quiz'
                : 'typing';
      historyAdapter.record({
        attemptId: result.attemptId ?? undefined,
        type: historyType,
        title: session.title,
        correct: result.correctCount,
        total: result.totalQuestions,
        accuracy: result.scorePercent,
        xp: result.xpEarned,
        duration: formatElapsed(elapsedSeconds),
        words: result.results.map((r) => ({
          vocabularyId: r.vocabularyId,
          word: r.word,
          phonetic: r.phonetic,
          meaning: r.vietnameseMeaning,
          ok: r.gradingStatus === 'exact',
        })),
      });
      notificationsAdapter.push({
        title: 'Hoàn tất phiên ôn tập',
        body: `Bạn vừa đạt ${result.scorePercent}% và nhận +${result.xpEarned} XP.`,
        icon: 'trophy',
        tone: result.passed ? 'green' : 'amber',
        targetRoute: '/history',
      });
      showToast(`Hoàn tất phiên ôn tập! Đạt ${result.scorePercent}% (+${result.xpEarned} XP)`, 'success');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ATTEMPT_ALREADY_SUBMITTED') {
        setAlreadySubmitted(true);
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

  function handleSrsRate(rating: 1 | 2 | 3 | 4) {
    if (!session || !currentQuestion) return;
    const targetWord = session.targetWordsByVocabId[currentQuestion.vocabularyId] ?? '';
    const expectedPositiveAnswer =
      session.origin === 'server_official' && currentQuestion.practiceMode === 'multiple_choice'
        ? currentQuestion.prompt.vietnameseMeaning ||
          session.dueLookup[currentQuestion.vocabularyId]?.vietnameseMeaning ||
          targetWord
        : targetWord;
    const mappedAnswer = rating >= 3 ? expectedPositiveAnswer : '';
    const updatedAnswers = { ...answers, [currentQuestion.vocabularyId]: mappedAnswer };
    setAnswers(updatedAnswers);

    if (currentIndex < session.questions.length - 1) {
      captureCurrentResponseTime();
      setCurrentIndex((prev) => prev + 1);
    } else {
      void submitSession(updatedAnswers);
    }
  }

  // Summary Screen
  if (summary && session) {
    const missedResults = summary.results.filter((item) => item.gradingStatus !== 'exact');
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <section className="rounded-3xl border border-indigo-100 bg-white p-6 text-center shadow-xs sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white">
            <Award className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-heading text-2xl font-extrabold text-slate-900">
            Tổng kết phiên ôn tập
          </h1>
          <p className="mt-1 font-heading text-4xl font-extrabold text-indigo-700">
            {summary.scorePercent}%
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Đúng hoàn toàn {summary.correctCount}/{summary.totalQuestions} câu • Thời gian {formatElapsed(elapsedSeconds)}
            {summary.origin === 'server_official' && (
              <>
                {' '}
                • <strong className="text-emerald-700">+{summary.xpEarned} XP</strong>
              </>
            )}
          </p>

          {summary.origin === 'client_custom_practice' && (
            <p className="mx-auto mt-3 max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800">
              Phiên luyện tập tự chọn — không ảnh hưởng lịch ôn tập hay chuỗi ngày học chính thức.
            </p>
          )}

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {missedResults.length > 0 && (
              <button
                type="button"
                onClick={() => handleRetryMissedWords(missedResults)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Ôn lại các từ sai ({missedResults.length})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setSession(null);
                setSummary(null);
                void dueQuery.refetch();
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
            >
              <span>Về Trung tâm Ôn tập</span>
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-heading text-lg font-extrabold text-slate-900">Chi tiết từng từ</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {summary.results.map((item) => {
              const meta = getGradingFeedbackMeta(item.gradingStatus);
              return (
                <div
                  key={`${item.vocabularyId}-${item.word}`}
                  className="flex flex-col justify-between gap-2 py-3.5 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="font-heading text-base text-slate-900">{item.word}</strong>
                      {item.phonetic && (
                        <span className="font-mono text-xs text-slate-500">{item.phonetic}</span>
                      )}
                      {item.newLeitnerBox && (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                          Hộp {item.newLeitnerBox}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Bạn nhập: <strong>{item.userAnswer || '(Bỏ trống)'}</strong> • {item.feedbackMessage}
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

  // Active Review Session Runner
  if (session && currentQuestion) {
    const isLast = currentIndex >= session.questions.length - 1;
    const effectiveMode: ReviewUiMode =
      session.origin === 'server_official' &&
      session.uiMode !== 'srs' &&
      currentQuestion.practiceMode === 'multiple_choice' &&
      Boolean(currentQuestion.prompt.options?.length)
        ? 'quiz'
        : session.uiMode === 'mixed'
          ? currentQuestion.practiceMode === 'multiple_choice'
            ? 'quiz'
            : currentQuestion.practiceMode === 'dictation'
              ? 'dictation'
              : 'typing'
          : session.uiMode;

    const currentDueItem = session.dueLookup[currentQuestion.vocabularyId];
    const spokenText =
      currentQuestion.prompt.word ||
      session.targetWordsByVocabId[currentQuestion.vocabularyId] ||
      currentDueItem?.word ||
      '';

    return (
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div>
            <h1 className="font-heading text-lg font-extrabold text-slate-900">{session.title}</h1>
            <p className="text-xs font-semibold text-slate-500">
              Câu {currentIndex + 1} / {session.questions.length}
              {session.origin === 'client_custom_practice' && ' • Phiên tự chọn'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatElapsed(elapsedSeconds)}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setSession(null);
                setSubmitError(null);
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-900"
            >
              Thoát
            </button>
          </div>
        </div>

        {session.origin === 'client_custom_practice' && (
          <div
            role="note"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800"
          >
            Phiên luyện tập tự chọn — không ảnh hưởng lịch ôn tập hay chuỗi ngày học chính thức.
          </div>
        )}

        {submitError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
          >
            <span>{submitError}</span>
            {alreadySubmitted && (
              <button
                type="button"
                onClick={() => {
                  setSession(null);
                  setSummary(null);
                  setAlreadySubmitted(false);
                  setSubmitError(null);
                  void dueQuery.refetch();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Về Trung tâm Ôn tập</span>
              </button>
            )}
          </div>
        )}

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          {effectiveMode === 'srs' && currentDueItem ? (
            <SrsFlashcardStage
              key={`${currentQuestion.vocabularyId}-${currentIndex}`}
              item={currentDueItem}
              onRate={handleSrsRate}
            />
          ) : effectiveMode === 'quiz' ? (
            (() => {
              const targetWord =
                session.targetWordsByVocabId[currentQuestion.vocabularyId] ||
                currentDueItem?.word ||
                '';
              const distractorPool = [
                ...Object.values(session.targetWordsByVocabId),
                ...dueItems.map((d) => d.word),
              ];
              const quizQuestion = buildClientQuizQuestion(
                currentQuestion,
                targetWord,
                distractorPool,
                currentDueItem?.vietnameseMeaning,
              );
              return quizQuestion.prompt.options?.length ? (
                <QuizQuestionStage
                  key={`${currentQuestion.vocabularyId}-${currentIndex}`}
                  question={quizQuestion}
                  selectedAnswer={answers[currentQuestion.vocabularyId] ?? ''}
                  onSelect={(val) =>
                    setAnswers((prev) => ({ ...prev, [currentQuestion.vocabularyId]: val }))
                  }
                  onEnterNext={() => (isLast ? void submitSession(answers) : handleNextQuestion())}
                />
              ) : (
                <TypingQuestionStage
                  key={`${currentQuestion.vocabularyId}-${currentIndex}`}
                  question={currentQuestion}
                  value={answers[currentQuestion.vocabularyId] ?? ''}
                  onChange={(val) =>
                    setAnswers((prev) => ({ ...prev, [currentQuestion.vocabularyId]: val }))
                  }
                  onEnterNext={() => (isLast ? void submitSession(answers) : handleNextQuestion())}
                />
              );
            })()
          ) : effectiveMode === 'dictation' ? (
            <DictationQuestionStage
              key={`${currentQuestion.vocabularyId}-${currentIndex}`}
              question={currentQuestion}
              spokenFallbackText={spokenText}
              value={answers[currentQuestion.vocabularyId] ?? ''}
              onChange={(val) =>
                setAnswers((prev) => ({ ...prev, [currentQuestion.vocabularyId]: val }))
              }
              onEnterNext={() => (isLast ? void submitSession(answers) : handleNextQuestion())}
            />
          ) : (
            <TypingQuestionStage
              key={`${currentQuestion.vocabularyId}-${currentIndex}`}
              question={currentQuestion}
              value={answers[currentQuestion.vocabularyId] ?? ''}
              onChange={(val) =>
                setAnswers((prev) => ({ ...prev, [currentQuestion.vocabularyId]: val }))
              }
              onEnterNext={() => (isLast ? void submitSession(answers) : handleNextQuestion())}
            />
          )}

          {effectiveMode !== 'srs' && (
            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
              {!isLast ? (
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
                  disabled={submitting || alreadySubmitted}
                  onClick={() => void submitSession(answers)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  <span>{submitting ? 'Đang chấm điểm...' : 'Nộp bài & Chấm điểm'}</span>
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  // Review Center Landing Screen
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full bg-[#f8fafc]">
      <header className="flex flex-col justify-between gap-4 px-5 pt-6 pb-2 sm:flex-row sm:items-center sm:px-7 sm:pt-7">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-slate-900">Trung tâm Ôn tập</h1>
          <p className="mt-1 text-sm text-slate-600">
            Củng cố trí nhớ dài hạn với 5 Hộp ghi nhớ, 4 chế độ luyện tập và chấm điểm thông minh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-800">
            {dueCount} từ đến hạn
          </span>
          {savedWords.length > 0 && (
            <button
              type="button"
              onClick={handleStartSavedWordsPractice}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100"
            >
              <Bookmark className="h-4 w-4" />
              <span>Ôn Sổ từ đã lưu ({savedWords.length})</span>
            </button>
          )}
          <button
            type="button"
            disabled={starting}
            onClick={() => void handleStartMixedQuiz()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-60"
          >
            <Shuffle className="h-4 w-4" />
            <span>Bài kiểm tra tổng hợp</span>
          </button>
        </div>
      </header>

      <div className="space-y-5 px-5 pt-4 pb-6 sm:px-7">

      {dueQuery.isError ? (
        <ErrorRetryBox
          message="Không thể tải danh sách từ cần ôn hôm nay. Vui lòng thử lại."
          onRetry={() => void dueQuery.refetch()}
        />
      ) : dueQuery.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <LeitnerBoxesBar
            distribution={distribution}
            selectedBox={selectedBox}
            onSelectBox={setSelectedBox}
          />

          {dueCount === 0 ? (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8 text-center">
              <h2 className="font-heading text-xl font-extrabold text-slate-900">
                Hôm nay bạn không còn từ nào cần ôn tập!
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
                Tuyệt vời! Bạn đã hoàn thành sạch lịch nhắc hôm nay. Hãy học thêm bài mới trên Lộ trình học hoặc tra cứu kho Oxford 3000.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link
                  to="/courses"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Học bài mới</span>
                </Link>
                <Link
                  to="/dictionary"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
                >
                  <Search className="h-4 w-4" />
                  <span>Tra từ Oxford 3000</span>
                </Link>
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="font-heading text-lg font-extrabold text-slate-900">
                    Chọn chế độ ôn tập
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedBox !== null
                      ? `Đang lọc xem ${filteredDuePreview.length} từ ở Hộp ${selectedBox}`
                      : `Sẵn sàng ôn tập ${dueCount} từ đến hạn hôm nay`}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={starting}
                  onClick={() => void handleStartOfficialSm2()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  <span>{starting ? 'Đang khởi tạo...' : 'Bắt đầu ôn tập'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {MODE_CARDS.map(({ id, label, desc, icon: Icon }) => {
                  const active = selectedMode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedMode(id)}
                      aria-pressed={active}
                      className={`flex flex-col items-start rounded-2xl border p-4 text-left transition ${
                        active
                          ? 'border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-100'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                          active ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'
                        }`}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <strong className="mt-3 font-heading text-sm font-extrabold text-slate-900">
                        {label}
                      </strong>
                      <span className="mt-1 text-xs text-slate-600">{desc}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
      </div>
    </div>
  );
}
