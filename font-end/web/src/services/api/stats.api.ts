import { httpClient } from '@/services/api/httpClient';
import type { StatsOverview } from '@/types/models';

export const statsApi = {
  getOverview(): Promise<StatsOverview> {
    return httpClient.get<StatsOverview>('/stats/overview');
  },
};
