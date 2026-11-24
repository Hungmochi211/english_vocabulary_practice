import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Lock, Search, Unlock } from 'lucide-react';
import { adminApi } from '@/services/api/admin.api';
import { ApiError } from '@/services/api/httpClient';
import {
  ConfirmModal,
  EmptyState,
  ErrorRetryBox,
  Skeleton,
  useToast,
} from '@/components/common/CommonUi';
import type { AdminUserRow } from '@/types/models';

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [pendingTarget, setPendingTarget] = useState<AdminUserRow | null>(null);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', searchText, page],
    queryFn: () => adminApi.listUsers({ q: searchText, page, limit: 10 }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: number; isActive: boolean; email: string }) =>
      adminApi.updateUserStatus(userId, isActive),
    onSuccess: (updated, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
      const activeAfter = updated?.isActive ?? variables.isActive;
      const targetEmail = updated?.email ?? variables.email;
      showToast(
        activeAfter
          ? `Đã mở khóa tài khoản ${targetEmail}`
          : `Đã khóa tài khoản ${targetEmail}`,
        'success',
      );
      setPendingTarget(null);
    },
    onError: (err) => {
      showToast(
        err instanceof ApiError ? err.message : 'Không thể cập nhật trạng thái tài khoản.',
        'error',
      );
    },
  });

  const items = usersQuery.data?.items ?? [];
  const totalPages = usersQuery.data?.totalPages ?? 1;

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
            Quản lý Học viên
          </h1>
        </div>

        <Link
          to="/admin/audit-logs"
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 sm:self-auto"
        >
          <ClipboardList className="h-4 w-4" />
          <span>Nhật ký Kiểm toán</span>
        </Link>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="search"
            aria-label="Tìm kiếm học viên"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo họ tên hoặc email học viên..."
            className="w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none"
          />
        </div>
      </section>

      {usersQuery.isError ? (
        <ErrorRetryBox
          message="Không thể tải danh sách học viên."
          onRetry={() => void usersQuery.refetch()}
        />
      ) : usersQuery.isLoading ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Không tìm thấy học viên phù hợp"
          description="Thử nhập từ khóa tên hoặc email khác."
        />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
                  <th className="px-4 py-3">Học viên</th>
                  <th className="px-4 py-3">CEFR</th>
                  <th className="px-4 py-3">Streak</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-900">{row.fullName}</p>
                      <p className="text-xs text-slate-500">{row.email}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                        {row.targetLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-semibold text-slate-700">
                      {row.currentStreak} ngày
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                          row.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {row.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setPendingTarget(row)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                          row.isActive
                            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {row.isActive ? (
                          <>
                            <Lock className="h-3.5 w-3.5" />
                            <span>Khóa tài khoản</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3.5 w-3.5" />
                            <span>Mở khóa</span>
                          </>
                        )}
                      </button>
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

      <ConfirmModal
        open={Boolean(pendingTarget)}
        title={pendingTarget?.isActive ? 'Xác nhận khóa tài khoản?' : 'Xác nhận mở khóa tài khoản?'}
        description={
          pendingTarget?.isActive
            ? `Tài khoản ${pendingTarget.email} sẽ bị tạm ngưng truy cập ngay lập tức cho đến khi được mở khóa lại.`
            : `Tài khoản ${pendingTarget?.email ?? ''} sẽ được khôi phục quyền đăng nhập và học tập bình thường.`
        }
        confirmLabel={pendingTarget?.isActive ? 'Xác nhận khóa' : 'Xác nhận mở khóa'}
        danger={Boolean(pendingTarget?.isActive)}
        loading={statusMutation.isPending}
        onCancel={() => setPendingTarget(null)}
        onConfirm={() => {
          if (!pendingTarget) return;
          statusMutation.mutate({
            userId: pendingTarget.id,
            isActive: !pendingTarget.isActive,
            email: pendingTarget.email,
          });
        }}
      />
    </div>
  );
}
