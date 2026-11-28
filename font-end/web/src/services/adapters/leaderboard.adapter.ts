import { statsApi } from '@/services/api/stats.api';
import type { CefrLevel, LeaderboardMember } from '@/types/models';

export type UnrankedLeaderboardMember = Omit<LeaderboardMember, 'rank'>;

export function rankLeaderboardMembers(
  members: UnrankedLeaderboardMember[],
): LeaderboardMember[] {
  return [...members]
    .sort(
      (a, b) =>
        b.weeklyXp - a.weeklyXp ||
        b.streakDays - a.streakDays ||
        b.wordsThisWeek - a.wordsThisWeek ||
        a.fullName.localeCompare(b.fullName),
    )
    .map((member, index) => ({
      ...member,
      rank: index + 1,
    }));
}

export function formatRankBadgeLabel(rank: number): string {
  if (rank === 1) return 'Hạng Vàng • Rank #1 nhóm';
  if (rank === 2) return 'Hạng Bạc • Rank #2 nhóm';
  if (rank === 3) return 'Hạng Đồng • Rank #3 nhóm';
  return `Thành viên tích cực • Rank #${rank} nhóm`;
}

export const leaderboardAdapter = {
  async getWeeklyGroupLeaderboard(_currentUser?: {
    fullName: string;
    avatarUrl: string | null;
    targetLevel: CefrLevel;
    totalXp: number;
    currentStreak: number;
  }): Promise<LeaderboardMember[]> {
    return statsApi.getWeeklyLeaderboard(20);
  },
};
