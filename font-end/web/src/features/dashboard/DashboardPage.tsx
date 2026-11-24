import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Layers,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { statsApi } from '@/services/api/stats.api';
import { learningApi } from '@/services/api/learning.api';
import { ErrorRetryBox, Skeleton } from '@/components/common/CommonUi';
import {
  AudioStandardCard,
  LearnedWordsCard,
  StreakCard,
  XpCard,
} from '@/components/common/StreakCard';
import { WeeklyLeaderboardWidget } from '@/features/dashboard/WeeklyLeaderboard';

const DAILY_GOAL_STORAGE_KEY = 'lexitag:v1:daily-goal';

function readDailyWordGoal(): number {
  try {
    const saved = Number(window.localStorage.getItem(DAILY_GOAL_STORAGE_KEY));
    return Number.isFinite(saved) && saved >= 5 && saved <= 100 ? Math.round(saved) : 15;
  } catch {
    return 15;
  }
}

export function DashboardPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const deniedAdmin = searchParams.get('denied') === 'admin';
  const dailyWordGoal = readDailyWordGoal();

  const overviewQuery = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => statsApi.getOverview(),
  });

  const lessonsQuery = useQuery({
    queryKey: ['learning', 'lessons', '', null],
    queryFn: () => learningApi.listLessons(),
  });

  const overview = overviewQuery.data;
  const lessons = lessonsQuery.data ?? [];

  const todayPoint = overview?.last7Days?.[overview.last7Days.length - 1];
  const wordsToday = todayPoint?.wordsStudied ?? 0;
  const goalPercent = Math.min(100, Math.round((wordsToday / dailyWordGoal) * 100));
  const ringRadius = 36;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - goalPercent / 100);

  const activeLessons = lessons.filter((l) => l.isUnlocked).slice(0, 3);

  if (overviewQuery.isError) {
    return (
      <div className="space-y-4">
        <h1 className="font-heading text-2xl font-extrabold text-slate-900">Bảng điều khiển Trang chủ</h1>
        <ErrorRetryBox
          message="Không thể tải dữ liệu tổng quan học tập. Vui lòng thử lại."
          onRetry={() => {
            void overviewQuery.refetch();
            void lessonsQuery.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {deniedAdmin && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-900"
        >
          <span className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Bạn không có quyền truy cập khu vực dành cho Quản trị viên.</span>
          </span>
          <button
            type="button"
            aria-label="Đóng thông báo quyền truy cập"
            onClick={() => {
              searchParams.delete('denied');
              setSearchParams(searchParams, { replace: true });
            }}
            className="rounded-lg p-1 text-amber-700 hover:bg-amber-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Hero Banner + Daily Goal Ring */}
      <section className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/90 via-white to-slate-50 p-6 shadow-xs sm:p-7">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-bold text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Mục tiêu CEFR {user?.targetLevel ?? 'B2'}</span>
            </span>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Bảng điều khiển Trang chủ
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-slate-600">
              Xin chào <strong className="text-slate-900">{user?.fullName ?? 'Học viên'}</strong>! Tiếp tục duy trì nhịp học 2 bước mỗi ngày để làm chủ trọn bộ Oxford 3000.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-2">
              <Link
                to="/courses"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <BookOpen className="h-4 w-4" />
                <span>Tiếp tục học lộ trình</span>
              </Link>
              <Link
                to="/review"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              >
                <GraduationCap className="h-4 w-4 text-indigo-600" />
                <span>Ôn tập SM-2 ngay</span>
              </Link>
            </div>
          </div>

          {/* Daily Goal Ring */}
          <div className="flex items-center gap-4 self-start rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-2xs md:self-auto">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 88 88" aria-hidden="true">
                <circle cx="44" cy="44" r={ringRadius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle
                  cx="44"
                  cy="44"
                  r={ringRadius}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <span className="absolute font-heading text-base font-extrabold text-slate-900">
                {goalPercent}%
              </span>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Mục tiêu ngày</p>
              <p className="mt-1 font-heading text-xl font-extrabold text-slate-900">
                {wordsToday} / {dailyWordGoal} từ
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {overview?.completedToday ? 'Đã hoàn thành mục tiêu hôm nay!' : 'Học thêm để giữ chuỗi Streak'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Synced KPI Cards */}
      <section aria-label="Chỉ số học tập" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-8 w-28" />
              <Skeleton className="mt-2 h-3 w-36" />
            </div>
          ))
        ) : (
          <>
            <LearnedWordsCard
              learnedWordsCount={overview?.learnedWordsCount ?? 0}
              compact
            />

            <AudioStandardCard compact />

            <StreakCard
              currentStreak={overview?.currentStreak ?? 0}
              longestStreak={overview?.longestStreak ?? 0}
              testId="dashboard-streak"
              compact
            />

            <XpCard
              totalXp={overview?.totalXp ?? 0}
              subtitle="Đồng bộ toàn hệ thống"
              testId="dashboard-xp"
              compact
            />
          </>
        )}
      </section>

      {/* Ongoing Courses & SRS Due Reminder */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-lg font-extrabold text-slate-900">Khóa học đang học</h2>
              <p className="text-xs text-slate-500">Hoàn tất Bước 1 (mở 100% thẻ) rồi đạt ≥ 80% Bước 2 để mở bài mới</p>
            </div>
            <Link
              to="/courses"
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline"
            >
              <span>Xem tất cả</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {lessonsQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : activeLessons.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có bài học nào khả dụng.</p>
          ) : (
            <div className="space-y-3">
              {activeLessons.map((lesson) => {
                const percent = lesson.wordCount > 0 ? Math.round((lesson.openedCount / lesson.wordCount) * 100) : 0;
                return (
                  <div
                    key={lesson.lessonId}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                          {lesson.cefrLevel}
                        </span>
                        <span className="text-xs font-medium text-slate-500">{lesson.topicName}</span>
                        {lesson.bestScore !== null && (
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                            Cao nhất: {lesson.bestScore}%
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 truncate font-heading text-base font-bold text-slate-900">
                        {lesson.title}
                      </h3>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-indigo-600 transition-all"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">
                          {lesson.openedCount}/{lesson.wordCount} thẻ
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Link
                        to={`/courses/${lesson.lessonId}/study`}
                        className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        Học thẻ
                      </Link>
                      {lesson.acquisitionCompleted && (
                        <Link
                          to={`/courses/${lesson.lessonId}/practice`}
                          className="rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
                        >
                          Thực hành
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SRS Due Reminder Widget */}
        <section className="flex flex-col justify-between rounded-2xl border border-amber-200/80 bg-gradient-to-b from-amber-50/80 to-white p-6 shadow-2xs">
          <div>
            <div className="flex items-center gap-2 text-amber-800">
              <Layers className="h-5 w-5" />
              <h2 className="font-heading text-lg font-extrabold">Nhắc ôn SM-2 hôm nay</h2>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Bạn đang có{' '}
              <strong className="font-heading text-base text-amber-800">
                {overview?.dueReviewsCount ?? 0} từ đến hạn
              </strong>{' '}
              cần củng cố để đẩy lên hộp Leitner cao hơn.
            </p>

            {overview?.leitnerDistribution && (
              <div className="mt-4 grid grid-cols-5 gap-1.5 text-center">
                {[
                  { label: 'H1', count: overview.leitnerDistribution.box1 },
                  { label: 'H2', count: overview.leitnerDistribution.box2 },
                  { label: 'H3', count: overview.leitnerDistribution.box3 },
                  { label: 'H4', count: overview.leitnerDistribution.box4 },
                  { label: 'H5', count: overview.leitnerDistribution.box5 },
                ].map((box) => (
                  <div key={box.label} className="rounded-xl border border-slate-200 bg-white px-1 py-2">
                    <span className="block text-[10px] font-bold text-slate-400">{box.label}</span>
                    <strong className="block text-sm font-extrabold text-slate-800">{box.count}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            to="/review"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-amber-700"
          >
            <span>Vào Trung tâm Ôn tập</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </div>

      {/* Weekly Group Leaderboard */}
      <WeeklyLeaderboardWidget
        totalXp={overview?.totalXp ?? 0}
        currentStreak={overview?.currentStreak ?? 0}
      />
    </div>
  );
}