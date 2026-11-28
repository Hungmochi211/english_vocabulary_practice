import { httpClient } from '@/services/api/httpClient';
import {
  normalizeLeaderboardMember,
  normalizeStatsOverview,
} from '@/services/api/normalizers';
import type { LeaderboardMember, StatsOverview } from '@/types/models';

export const statsApi = {
  async getOverview(): Promise<StatsOverview> {
    const raw = await httpClient.get<unknown>('/stats/overview');
    return normalizeStatsOverview(raw);
  },

  async getWeeklyLeaderboard(limit = 20): Promise<LeaderboardMember[]> {
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit || 20)));
    const raw = await httpClient.get<unknown>('/stats/leaderboard', {
      params: { limit: safeLimit },
    });
    if (!Array.isArray(raw)) return [];
    return raw.map((item, idx) => normalizeLeaderboardMember(item, idx + 1));
  },
};
