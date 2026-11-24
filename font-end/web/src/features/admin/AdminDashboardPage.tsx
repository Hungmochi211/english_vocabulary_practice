import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  BookOpen,
  ClipboardList,
  Shield,
  Users,
} from 'lucide-react';
import { adminApi } from '@/services/api/admin.api';
import { ErrorRetryBox, Skeleton } from '@/components/common/CommonUi';
import { formatXp } from '@/utils/formatters';

export function AdminDashboardPage() {
  const statsQuery = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getSystemStats(),
  });

  const stats = statsQuery.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-6 sm:flex-row sm:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-bold text-amber-800">
            <Shield className="h-3.5 w-3.5" />
            <span>Admin Portal</span>
          </span>
          <h1 className="mt-2 font-heading text-2xl font-extrabold text-slate-900">
            Tổng quan Quản trị Hệ thống
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Theo dõi chỉ số vận hành theo thời gian thực, quản lý tài khoản học viên và tra cứu nhật ký kiểm toán.
          </p>
        </div>

        <nav aria-label="Điều hướng quản trị" className="flex flex-wrap gap-2">
          <Link
            to="/admin/users"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800"
          >
            <Users className="h-4 w-4" />
            <span>Quản lý Học viên</span>
          </Link>
          <Link
            to="/admin/audit-logs"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-800 transition hover:bg-slate-50"
          >
            <ClipboardList className="h-4 w-4" />
            <span>Nhật ký Kiểm toán</span>
          </Link>
        </nav>
      </header>

      {statsQuery.isError ? (
        <ErrorRetryBox
          message="Không thể tải thống kê quản trị hệ thống."
          onRetry={() => void statsQuery.refetch()}
        />
      ) : (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statsQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mt-3 h-8 w-24" />
              </div>
            ))
          ) : (
            <>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <span className="text-xs font-bold uppercase text-slate-400">Tổng học viên</span>
                <p className="mt-2 font-heading text-3xl font-extrabold text-slate-900">
                  {formatXp(stats?.totalUsers ?? 0)}
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <span className="text-xs font-bold uppercase text-slate-400">Hoạt động hôm nay</span>
                <p className="mt-2 font-heading text-3xl font-extrabold text-emerald-700">
                  {formatXp(stats?.activeUsersToday ?? 0)}
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <span className="text-xs font-bold uppercase text-slate-400">Kho từ Oxford 3000</span>
                <p className="mt-2 font-heading text-3xl font-extrabold text-indigo-700">
                  {formatXp(stats?.totalVocabularyCount ?? 0)}
                </p>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
                <span className="text-xs font-bold uppercase text-slate-400">Lượt làm bài hôm nay</span>
                <p className="mt-2 font-heading text-3xl font-extrabold text-amber-700">
                  {formatXp(stats?.totalAttemptsToday ?? 0)}
                </p>
              </article>
            </>
          )}
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          to="/admin/users"
          className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:border-indigo-300"
        >
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-heading text-base font-extrabold text-slate-900">
                Danh sách & Trạng thái Học viên
              </h2>
              <p className="text-xs text-slate-500">
                Tìm kiếm theo tên/email và khóa hoặc mở khóa tài khoản có xác nhận.
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-700" />
        </Link>

        <Link
          to="/admin/audit-logs"
          className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:border-amber-300"
        >
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-heading text-base font-extrabold text-slate-900">
                Nhật ký Kiểm toán (Audit Logs)
              </h2>
              <p className="text-xs text-slate-500">
                Tra cứu lịch sử thao tác quản trị theo trình tự thời gian mới nhất.
              </p>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-amber-700" />
        </Link>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-600">
        <p className="flex items-center gap-2 font-bold text-slate-800">
          <BookOpen className="h-4 w-4 text-indigo-600" />
          <span>Lưu ý phân quyền RBAC:</span>
        </p>
        <p className="mt-1">
          Mọi thao tác thay đổi trạng thái tài khoản đều được ghi vào Nhật ký Kiểm toán phía máy chủ và có thể khôi phục bất kỳ lúc nào.
        </p>
      </div>
    </div>
  );
}
