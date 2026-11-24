import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, Crown, Flame, Trophy, Users, X, Zap } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import {
  formatRankBadgeLabel,
  leaderboardAdapter,
} from '@/services/adapters/leaderboard.adapter';
import { EmptyState, ErrorRetryBox, Skeleton } from '@/components/common/CommonUi';
import { formatXp, getInitials } from '@/utils/formatters';
import type { CefrLevel, LeaderboardMember } from '@/types/models';

const LEVEL_PILL_STYLE: Record<CefrLevel, string> = {
  A1: 'border-amber-200 bg-amber-50 text-amber-800',
  A2: 'border-sky-200 bg-sky-50 text-sky-700',
  B1: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  B2: 'border-indigo-200 bg-indigo-50 text-indigo-700',
};

const INITIALS_GRADIENTS = [
  'from-indigo-500 to-violet-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-sky-500 to-blue-600',
  'from-rose-500 to-pink-600',
];

function getRankCircleStyle(rank: number): string {
  if (rank === 1) {
    return 'border-amber-400 bg-gradient-to-b from-amber-50 to-amber-100 text-amber-800 shadow-[0_2px_0_#fde68a]';
  }
  if (rank === 2) {
    return 'border-slate-300 bg-gradient-to-b from-slate-50 to-slate-200/80 text-slate-700 shadow-[0_2px_0_#e2e8f0]';
  }
  if (rank === 3) {
    return 'border-orange-300 bg-gradient-to-b from-orange-50 to-orange-100 text-orange-800 shadow-[0_2px_0_#fed7aa]';
  }
  return 'border-slate-200 bg-slate-50 text-slate-500';
}

function MemberAvatar({
  member,
  size = 'md',
}: {
  member: LeaderboardMember;
  size?: 'md' | 'lg';
}) {
  const gradient =
    INITIALS_GRADIENTS[(member.rank - 1) % INITIALS_GRADIENTS.length] ?? INITIALS_GRADIENTS[0];
  const circleSize = size === 'lg' ? 'h-14 w-14 text-lg' : 'h-11 w-11 text-xs';

  return (
    <div className="relative shrink-0">
      <div
        className={`flex items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br font-heading font-extrabold text-white shadow-xs ring-1 ring-slate-200/90 ${gradient} ${circleSize}`}
      >
        {member.avatarUrl ? (
          <img
            src={member.avatarUrl}
            alt={`Ảnh đại diện của ${member.fullName}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{getInitials(member.fullName)}</span>
        )}
      </div>

      {/* Top 1 Crown Pin */}
      {member.rank === 1 && (
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-xs"
        >
          <Crown className="h-3 w-3" />
        </span>
      )}

      {/* CEFR Level Pill tucked at bottom-right */}
      <span
        className={`absolute -right-1 -bottom-1 rounded-full border px-1.5 py-0.5 text-[9px] font-extrabold leading-none shadow-2xs ${LEVEL_PILL_STYLE[member.level]}`}
      >
        {member.level}
      </span>
    </div>
  );
}

function LeaderboardRow({
  member,
  onClick,
}: {
  member: LeaderboardMember;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition ${
        member.isCurrentUser
          ? 'border-indigo-300 bg-gradient-to-r from-indigo-50/90 via-indigo-50/50 to-white shadow-2xs'
          : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/70'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-heading text-xs font-extrabold ${getRankCircleStyle(
            member.rank,
          )}`}
        >
          #{member.rank}
        </span>

        <MemberAvatar member={member} />

        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-bold text-slate-900 transition group-hover:text-indigo-700">
            <span className="truncate">{member.fullName}</span>
            {member.isCurrentUser && (
              <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                Bạn
              </span>
            )}
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-[11px] font-medium text-slate-500">
            <span>{member.wordsThisWeek} từ tuần này</span>
            <span className="inline-flex items-center gap-0.5 font-semibold text-orange-600">
              <Flame className="h-3 w-3" />
              {member.streakDays} ngày
            </span>
          </p>
        </div>
      </div>

      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50/80 px-2.5 py-1 text-xs font-extrabold text-indigo-700">
        <Zap className="h-3.5 w-3.5" />
        <span>{formatXp(member.weeklyXp)} XP</span>
      </span>
    </button>
  );
}

export function QuickProfileModal({
  member,
  onClose,
}: {
  member: LeaderboardMember | null;
  onClose: () => void;
}) {
  if (!member) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hồ sơ công khai"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
            {formatRankBadgeLabel(member.rank)}
          </span>
          <button
            type="button"
            aria-label="Đóng hồ sơ nhanh"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3.5">
          <MemberAvatar member={member} size="lg" />
          <div>
            <h3 className="font-heading text-lg font-extrabold text-slate-900">
              {member.fullName}
            </h3>
            <p className="text-xs font-semibold text-slate-500">
              Mục tiêu CEFR {member.level} • Thành viên nhóm học
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
            <span className="block text-[10px] font-bold uppercase text-slate-400">XP tuần</span>
            <strong className="mt-0.5 block text-sm font-extrabold text-indigo-700">
              {formatXp(member.weeklyXp)}
            </strong>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
            <span className="block text-[10px] font-bold uppercase text-slate-400">Từ tuần</span>
            <strong className="mt-0.5 block text-sm font-extrabold text-slate-900">
              {member.wordsThisWeek}
            </strong>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
            <span className="block text-[10px] font-bold uppercase text-slate-400">Streak</span>
            <strong className="mt-0.5 block text-sm font-extrabold text-amber-700">
              {member.streakDays} ngày
            </strong>
          </div>
        </div>

        {member.badges.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {member.badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function GroupLeaderboardModal({
  open,
  loading,
  error,
  members,
  onRetry,
  onSelectMember,
  onClose,
}: {
  open: boolean;
  loading: boolean;
  error: boolean;
  members: LeaderboardMember[];
  onRetry: () => void;
  onSelectMember: (member: LeaderboardMember) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bảng xếp hạng nhóm tuần này"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h2 className="font-heading text-lg font-extrabold text-slate-900">
              Bảng xếp hạng nhóm tuần này
            </h2>
          </div>
          <button
            type="button"
            aria-label="Đóng bảng xếp hạng"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <ErrorRetryBox message="Không thể tải bảng xếp hạng tuần." onRetry={onRetry} />
          ) : members.length === 0 ? (
            <EmptyState
              title="Chưa có dữ liệu xếp hạng tuần"
              description="Hoàn thành phiên học hôm nay để ghi danh lên Bảng xếp hạng tuần."
            />
          ) : (
            <div className="space-y-2.5">
              {members.map((member) => (
                <LeaderboardRow
                  key={member.userId}
                  member={member}
                  onClick={() => onSelectMember(member)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function WeeklyLeaderboardWidget({
  totalXp,
  currentStreak,
}: {
  totalXp: number;
  currentStreak: number;
}) {
  const { user } = useAuth();
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<LeaderboardMember | null>(null);

  const query = useQuery({
    queryKey: [
      'leaderboard',
      'weekly',
      user?.fullName,
      user?.avatarUrl,
      user?.targetLevel,
      totalXp,
      currentStreak,
    ],
    queryFn: () =>
      leaderboardAdapter.getWeeklyGroupLeaderboard({
        fullName: user?.fullName ?? 'Học viên',
        avatarUrl: user?.avatarUrl ?? null,
        targetLevel: user?.targetLevel ?? 'B2',
        totalXp,
        currentStreak,
      }),
  });

  const members = query.data ?? [];
  const me = members.find((m) => m.isCurrentUser);
  const topPreview = members.slice(0, 4);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h2 className="font-heading text-lg font-extrabold text-slate-900">
              Bảng xếp hạng Tuần
            </h2>
          </div>
          {me && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700">
              <Award className="h-3.5 w-3.5" />
              <span>{formatRankBadgeLabel(me.rank)}</span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setGroupModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-100"
        >
          <Users className="h-4 w-4" />
          <span>Xem toàn bộ nhóm</span>
        </button>
      </div>

      {query.isLoading ? (
        <div className="mt-4 space-y-2.5">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {topPreview.map((member) => (
            <LeaderboardRow
              key={member.userId}
              member={member}
              onClick={() => setSelectedMember(member)}
            />
          ))}
        </div>
      )}

      <GroupLeaderboardModal
        open={groupModalOpen}
        loading={query.isLoading}
        error={query.isError}
        members={members}
        onRetry={() => void query.refetch()}
        onSelectMember={(member) => setSelectedMember(member)}
        onClose={() => setGroupModalOpen(false)}
      />

      <QuickProfileModal member={selectedMember} onClose={() => setSelectedMember(null)} />
    </section>
  );
}