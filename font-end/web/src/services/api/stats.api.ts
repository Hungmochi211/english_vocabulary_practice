import { httpClient } from '@/services/api/httpClient';
import { normalizeStatsOverview } from '@/services/api/normalizers';
import type { StatsOverview } from '@/types/models';

export const statsApi = {
  async getOverview(): Promise<StatsOverview> {
    const raw = await httpClient.get<unknown>('/stats/overview');
    return normalizeStatsOverview(raw);
  },
};
