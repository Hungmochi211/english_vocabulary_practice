import { describe, expect, it } from 'vitest';
import {
  formatRankBadgeLabel,
  rankLeaderboardMembers,
} from '@/services/adapters/leaderboard.adapter';

describe('T049 - US6: Weekly Leaderboard Ranking & Tier Formatting', () => {
  it('ranks members descending by weeklyXp and promotes current user from #3 to #2 when XP exceeds 2,840', () => {
    const basePeers = [
      {
        userId: 'peer-1',
        fullName: 'Minh Khôi',
        avatarUrl: null,
        level: 'B2' as const,
        weeklyXp: 3120,
        wordsThisWeek: 145,
        streakDays: 21,
        badges: ['Bền bỉ'],
        isCurrentUser: false,
      },
      {
        userId: 'peer-2',
        fullName: 'Thu Hà',
        avatarUrl: null,
        level: 'B1' as const,
        weeklyXp: 2840,
        wordsThisWeek: 120,
        streakDays: 14,
        badges: ['Tốc độ'],
        isCurrentUser: false,
      },
    ];

    const beforeJump = rankLeaderboardMembers([
      ...basePeers,
      {
        userId: 'me',
        fullName: 'Nguyễn An',
        avatarUrl: null,
        level: 'B2',
        weeklyXp: 2450,
        wordsThisWeek: 98,
        streakDays: 7,
        badges: [],
        isCurrentUser: true,
      },
    ]);
    expect(beforeJump.find((m) => m.isCurrentUser)?.rank).toBe(3);

    const afterJump = rankLeaderboardMembers([
      ...basePeers,
      {
        userId: 'me',
        fullName: 'Nguyễn An',
        avatarUrl: null,
        level: 'B2',
        weeklyXp: 2900,
        wordsThisWeek: 124,
        streakDays: 8,
        badges: [],
        isCurrentUser: true,
      },
    ]);
    expect(afterJump.find((m) => m.isCurrentUser)?.rank).toBe(2);
    expect(afterJump[1].fullName).toBe('Nguyễn An');
  });

  it('formats Gold/Silver/Bronze group rank badge labels accurately', () => {
    expect(formatRankBadgeLabel(1)).toBe('Hạng Vàng • Rank #1 nhóm');
    expect(formatRankBadgeLabel(2)).toBe('Hạng Bạc • Rank #2 nhóm');
    expect(formatRankBadgeLabel(3)).toBe('Hạng Đồng • Rank #3 nhóm');
    expect(formatRankBadgeLabel(5)).toBe('Thành viên tích cực • Rank #5 nhóm');
  });
});
