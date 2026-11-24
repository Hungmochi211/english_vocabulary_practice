import type { ReactNode } from 'react';
import { BookOpen, Sparkles, Trophy, Volume2 } from 'lucide-react';
import { formatXp } from '@/utils/formatters';

type BadgeVariant = 'streak' | 'xp' | 'words' | 'audio';

function LexiMetricCrest({ variant, compact }: { variant: BadgeVariant; compact?: boolean }) {
  const sizeClass = compact ? 'h-14 w-14 rounded-2xl' : 'h-[68px] w-[68px] rounded-[20px]';
  const iconClass = compact ? 'h-9 w-9' : 'h-11 w-11';

  if (variant === 'streak') {
    return (
      <div
        aria-hidden="true"
        className={`relative flex shrink-0 items-center justify-center border-2 border-[#fda481] bg-gradient-to-br from-[#fff5f0] via-[#ffe8dc] to-[#ffd8c7] shadow-[0_3px_0_#fbc4ae] ${sizeClass}`}
      >
        <svg viewBox="0 0 64 64" fill="none" className={iconClass}>
          <defs>
            <linearGradient id="lexiFlameOuter" x1="18" y1="10" x2="48" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF7A45" />
              <stop offset="55%" stopColor="#F95738" />
              <stop offset="100%" stopColor="#DC2F4A" />
            </linearGradient>
            <linearGradient id="lexiFlameInner" x1="32" y1="26" x2="32" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFE17D" />
              <stop offset="100%" stopColor="#FFA93A" />
            </linearGradient>
          </defs>
          {/* Decorative sparkle dot */}
          <circle cx="49" cy="15" r="2.6" fill="#FB923C" />
          <path d="M14 21L15.6 17.5L17.2 21L20.7 22.6L17.2 24.2L15.6 27.7L14 24.2L10.5 22.6L14 21Z" fill="#FDBA74" />
          {/* Main stylized LexiTag twin-tip flame */}
          <path
            d="M34.5 9.5C37.2 15.8 45.8 20.6 47.4 31.2C48.9 41.2 42.3 52 31.8 52.8C21.5 53.6 14.5 45.4 15.3 35.1C15.8 28.8 19.6 23.4 23.6 19.6C23.2 23.5 24.6 26.2 26.8 27.4C26.1 20.2 29.4 13.7 34.5 9.5Z"
            fill="url(#lexiFlameOuter)"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Bright golden inner flame */}
          <path
            d="M32.4 27.2C36 31.2 39.2 35.2 38.7 40.3C38.2 45 34.6 48.2 30.8 48C27 47.8 24.2 44.5 24.7 39.8C25.1 35.7 28.5 31.5 32.4 27.2Z"
            fill="url(#lexiFlameInner)"
          />
        </svg>
      </div>
    );
  }

  if (variant === 'xp') {
    return (
      <div
        aria-hidden="true"
        className={`relative flex shrink-0 items-center justify-center border-2 border-[#a5b4fc] bg-gradient-to-br from-[#f5f3ff] via-[#e8eaff] to-[#dbe4ff] shadow-[0_3px_0_#c7d2fe] ${sizeClass}`}
      >
        <svg viewBox="0 0 64 64" fill="none" className={iconClass}>
          <defs>
            <linearGradient id="lexiBoltMain" x1="20" y1="10" x2="46" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#6366F1" />
              <stop offset="55%" stopColor="#4F46E5" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
            <linearGradient id="lexiBoltHi" x1="26" y1="16" x2="36" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E0E7FF" />
              <stop offset="100%" stopColor="#A5B4FC" />
            </linearGradient>
          </defs>
          {/* Sparkle stars */}
          <path d="M47 13L48.7 16.7L52.4 18.4L48.7 20.1L47 23.8L45.3 20.1L41.6 18.4L45.3 16.7L47 13Z" fill="#818CF8" />
          <circle cx="15" cy="46" r="2.6" fill="#A78BFA" />
          {/* Hexagonal lightning crest */}
          <path
            d="M36.5 10L17.5 34.5H30.5L26.5 54L46.5 28.5H33.2L36.5 10Z"
            fill="url(#lexiBoltMain)"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M33.2 17.5L23.2 31.2H31.8L33.2 17.5Z" fill="url(#lexiBoltHi)" opacity="0.65" />
        </svg>
      </div>
    );
  }

  if (variant === 'words') {
    return (
      <div
        aria-hidden="true"
        className={`relative flex shrink-0 items-center justify-center border-2 border-[#6ee7b7] bg-gradient-to-br from-[#ecfdf5] via-[#d7fbe8] to-[#bbf7d0] shadow-[0_3px_0_#a7f3d0] ${sizeClass}`}
      >
        <svg viewBox="0 0 64 64" fill="none" className={iconClass}>
          <defs>
            <linearGradient id="lexiCardBg" x1="14" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>
          </defs>
          {/* Back stacked flashcard */}
          <rect
            x="20"
            y="11"
            width="30"
            height="36"
            rx="7"
            transform="rotate(8 20 11)"
            fill="#6EE7B7"
            stroke="#FFFFFF"
            strokeWidth="2.4"
          />
          {/* Front flashcard */}
          <rect
            x="13"
            y="15"
            width="31"
            height="37"
            rx="7.5"
            fill="url(#lexiCardBg)"
            stroke="#FFFFFF"
            strokeWidth="2.8"
          />
          {/* Text lines on flashcard */}
          <rect x="20" y="24" width="16" height="3.4" rx="1.7" fill="#D1FAE5" />
          <rect x="20" y="31" width="11" height="3" rx="1.5" fill="#A7F3D0" opacity="0.85" />
          {/* Verified check seal */}
          <circle cx="44" cy="45" r="9.5" fill="#059669" stroke="#FFFFFF" strokeWidth="2.8" />
          <path
            d="M40.2 45.2L42.8 47.8L48.2 42.3"
            stroke="#FFFFFF"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center border-2 border-[#7dd3fc] bg-gradient-to-br from-[#f0f9ff] via-[#e0f2fe] to-[#bae6fd] shadow-[0_3px_0_#bae6fd] ${sizeClass}`}
    >
      <svg viewBox="0 0 64 64" fill="none" className={iconClass}>
        <defs>
          <linearGradient id="lexiAudioGrad" x1="14" y1="16" x2="50" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>
        </defs>
        <rect
          x="13"
          y="16"
          width="38"
          height="32"
          rx="10"
          fill="url(#lexiAudioGrad)"
          stroke="#FFFFFF"
          strokeWidth="2.8"
        />
        <rect x="21" y="28" width="3.5" height="8" rx="1.75" fill="#E0F2FE" />
        <rect x="27.5" y="23" width="3.5" height="18" rx="1.75" fill="#FFFFFF" />
        <rect x="34" y="26" width="3.5" height="12" rx="1.75" fill="#BAE6FD" />
        <rect x="40.5" y="29" width="3.5" height="6" rx="1.75" fill="#E0F2FE" />
      </svg>
    </div>
  );
}

interface MetricBadgeCardProps {
  variant: BadgeVariant;
  label: string;
  value: string | number;
  unit?: string;
  subtitle: string;
  subtitleIcon?: ReactNode;
  testId?: string;
  compact?: boolean;
}

export function MetricBadgeCard({
  variant,
  label,
  value,
  unit,
  subtitle,
  subtitleIcon,
  testId,
  compact = false,
}: MetricBadgeCardProps) {
  return (
    <article
      className={`flex min-w-0 items-center overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs transition hover:border-slate-300 ${
        compact ? 'gap-3 p-4' : 'gap-4 p-4 sm:p-5'
      }`}
    >
      <LexiMetricCrest variant={variant} compact={compact} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-slate-500 sm:text-sm">{label}</p>
        <p
          data-testid={testId}
          className="mt-0.5 flex flex-wrap items-baseline gap-1 font-heading leading-tight"
        >
          <span
            className={`font-extrabold tracking-tight text-slate-900 ${
              compact ? 'text-2xl' : 'text-3xl'
            }`}
          >
            {value}
          </span>
          {unit ? (
            <>
              {' '}
              <span className={`font-semibold text-slate-500 ${compact ? 'text-sm' : 'text-base'}`}>
                {unit}
              </span>
            </>
          ) : null}
        </p>
        <p
          title={subtitle}
          className="mt-1.5 flex w-full min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500"
        >
          {subtitleIcon}
          <span className="min-w-0 flex-1 truncate">{subtitle}</span>
        </p>
      </div>
    </article>
  );
}

export function StreakCard({
  currentStreak,
  longestStreak,
  testId,
  compact = false,
}: {
  currentStreak: number;
  longestStreak: number;
  testId?: string;
  compact?: boolean;
}) {
  return (
    <MetricBadgeCard
      variant="streak"
      label="Streak hiện tại"
      value={currentStreak}
      unit="ngày"
      subtitle={`Cao nhất: ${longestStreak} ngày`}
      subtitleIcon={<Trophy className="h-3.5 w-3.5 shrink-0 text-orange-400" />}
      testId={testId}
      compact={compact}
    />
  );
}

export function XpCard({
  totalXp,
  subtitle = 'Đồng bộ toàn hệ thống',
  testId,
  compact = false,
}: {
  totalXp: number;
  subtitle?: string;
  testId?: string;
  compact?: boolean;
}) {
  return (
    <MetricBadgeCard
      variant="xp"
      label="Tổng điểm XP"
      value={formatXp(totalXp)}
      unit="XP"
      subtitle={subtitle}
      subtitleIcon={<Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-400" />}
      testId={testId}
      compact={compact}
    />
  );
}

export function LearnedWordsCard({
  learnedWordsCount,
  totalCatalog = 3813,
  compact = false,
}: {
  learnedWordsCount: number;
  totalCatalog?: number;
  compact?: boolean;
}) {
  const percent = totalCatalog > 0 ? Math.min(100, Math.round((learnedWordsCount / totalCatalog) * 100)) : 0;
  return (
    <MetricBadgeCard
      variant="words"
      label="Từ đã thuộc"
      value={formatXp(learnedWordsCount)}
      unit="từ"
      subtitle={`${percent}% Oxford 3000`}
      subtitleIcon={<BookOpen className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
      compact={compact}
    />
  );
}

export function AudioStandardCard({ compact = false }: { compact?: boolean }) {
  return (
    <MetricBadgeCard
      variant="audio"
      label="Phát âm chuẩn"
      value="US / UK"
      subtitle="Tốc độ 1.0× & 0.7×"
      subtitleIcon={<Volume2 className="h-3.5 w-3.5 shrink-0 text-sky-500" />}
      compact={compact}
    />
  );
}