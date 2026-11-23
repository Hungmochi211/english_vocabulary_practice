import { httpClient } from '@/services/api/httpClient';
import type {
  AdminSystemStats,
  AdminUserRow,
  AuditLogEntry,
  PaginatedData,
} from '@/types/models';

export const adminApi = {
  getSystemStats(): Promise<AdminSystemStats> {
    return httpClient.get<AdminSystemStats>('/admin/stats');
  },

  listUsers(params?: {
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedData<AdminUserRow>> {
    const query: Record<string, string | number> = {};
    if (params?.q?.trim()) query.q = params.q.trim();
    if (params?.page) query.page = params.page;
    if (params?.limit) query.limit = params.limit;
    return httpClient.get<PaginatedData<AdminUserRow>>('/admin/users', { params: query });
  },

  updateUserStatus(userId: number, isActive: boolean): Promise<AdminUserRow> {
    return httpClient.patch<AdminUserRow>(`/admin/users/${userId}/status`, { isActive });
  },

  listAuditLogs(params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedData<AuditLogEntry>> {
    return httpClient.get<PaginatedData<AuditLogEntry>>('/admin/audit-logs', { params });
  },
};
