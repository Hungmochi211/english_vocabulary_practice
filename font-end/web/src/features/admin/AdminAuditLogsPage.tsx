import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Users } from 'lucide-react';
import { adminApi } from '@/services/api/admin.api';
import { EmptyState, ErrorRetryBox, Skeleton } from '@/components/common/CommonUi';

export function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);

  const logsQuery = useQuery({
    queryKey: ['admin', 'audit-logs', page],
    queryFn: () => adminApi.listAuditLogs({ page, limit: 15 }),
  });

  const items = logsQuery.data?.items ?? [];
  const totalPages = logsQuery.data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:flex-row sm:items-center">
        <div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Về Tổng quan Quản trị</span>
          </Link>
          <h1 className="mt-1 font-heading text-2xl font-extrabold text-slate-900">
            Nhật ký Kiểm toán
          </h1>
        </div>

        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 sm:self-auto"
        >
          <Users className="h-4 w-4" />
          <span>Quản lý Học viên</span>
        </Link>
      </header>

      {logsQuery.isError ? (
        <ErrorRetryBox
          message="Không thể tải nhật ký kiểm toán."
          onRetry={() => void logsQuery.refetch()}
        />
      ) : logsQuery.isLoading ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Chưa có bản ghi kiểm toán nào"
          description="Các thao tác quản trị hệ thống sẽ tự động được ghi nhận tại đây."
        />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                  <th className="px-4 py-3">Hành động</th>
                  <th className="px-4 py-3">Người thực hiện</th>
                  <th className="px-4 py-3">Đối tượng</th>
                  <th className="px-4 py-3">Thời điểm</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3.5">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-800">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-700">
                      {log.actorEmail || `Admin #${log.actorId}`}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {log.targetType} #{log.targetId}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                      {new Date(log.createdAt).toLocaleString('vi-VN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
            <span>
              Trang {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40"
              >
                Trang trước
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:opacity-40"
              >
                Trang sau
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
