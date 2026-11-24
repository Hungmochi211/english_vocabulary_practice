import { httpClient } from '@/services/api/httpClient';
import {
  normalizeAdminSystemStats,
  normalizeAdminUserRow,
  normalizeAuditLogEntry,
  normalizePaginatedData,
} from '@/services/api/normalizers';
import type {
  AdminSystemStats,
  AdminUserRow,
  AuditLogEntry,
  PaginatedData,
} from '@/types/models';

export const adminApi = {
  async getSystemStats(): Promise<AdminSystemStats> {
    const raw = await httpClient.get<unknown>('/admin/stats');
    return normalizeAdminSystemStats(raw);
  },

  async listUsers(params?: {
    q?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedData<AdminUserRow>> {
    const query: Record<string, string | number> = {};
    if (params?.q?.trim()) query.q = params.q.trim();
    if (params?.page) query.page = params.page;
    if (params?.limit) query.limit = Math.max(1, Math.min(100, params.limit));
    const raw = await httpClient.get<unknown>('/admin/users', { params: query });
    return normalizePaginatedData(raw, normalizeAdminUserRow);
  },

  updateUserStatus(userId: number, isActive: boolean): Promise<AdminUserRow | null> {
    return httpClient.patch<AdminUserRow | null>(`/admin/users/${userId}/status`, { isActive });
  },

  async listAuditLogs(params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedData<AuditLogEntry>> {
    const query: Record<string, number> = {};
    if (params?.page) query.page = params.page;
    if (params?.limit) query.limit = Math.max(1, Math.min(100, params.limit));
    const raw = await httpClient.get<unknown>('/admin/audit-logs', { params: query });
    return normalizePaginatedData(raw, normalizeAuditLogEntry);
  },
};
