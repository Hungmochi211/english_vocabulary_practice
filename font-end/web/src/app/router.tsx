import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/AuthProvider';
import { AppShell } from '@/components/layout/AppShell';
import { Skeleton } from '@/components/common/CommonUi';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { CoursesRoadmapPage } from '@/features/courses/CoursesRoadmapPage';
import { LessonStudyPage } from '@/features/courses/LessonStudyPage';
import { LessonPracticePage } from '@/features/courses/LessonPracticePage';
import { ReviewCenterPage } from '@/features/review/ReviewCenterPage';

const DictionaryPage = lazy(() =>
  import('@/features/dictionary/DictionaryPage').then((m) => ({ default: m.DictionaryPage })),
);
const AiChatPage = lazy(() =>
  import('@/features/ai-chat/AiChatPage').then((m) => ({ default: m.AiChatPage })),
);
const HistoryPage = lazy(() =>
  import('@/features/history/HistoryPage').then((m) => ({ default: m.HistoryPage })),
);
const ProfilePage = lazy(() =>
  import('@/features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const AdminDashboardPage = lazy(() =>
  import('@/features/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminUsersPage = lazy(() =>
  import('@/features/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })),
);
const AdminAuditLogsPage = lazy(() =>
  import('@/features/admin/AdminAuditLogsPage').then((m) => ({ default: m.AdminAuditLogsPage })),
);
const AdminSupportPage = lazy(() =>
  import('@/features/admin/AdminSupportPage').then((m) => ({ default: m.AdminSupportPage })),
);

function RouteSkeleton() {
  return (
    <div aria-busy="true" className="space-y-4">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}

function GuestOnlyRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (isAuthenticated) {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');
    const safeTarget =
      redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/';
    return <Navigate to={safeTarget} replace />;
  }
  return <Outlet />;
}

function ProtectedRoute() {
  const { isAuthenticated, invalidReason } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    const reasonParam = invalidReason ? `&reason=${invalidReason}` : '';
    return <Navigate to={`/login?redirect=${redirect}${reasonParam}`} replace />;
  }
  return <Outlet />;
}

function AdminRoute() {
  const { isAuthenticated, isAdmin, invalidReason } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    const reasonParam = invalidReason ? `&reason=${invalidReason}` : '';
    return <Navigate to={`/login?redirect=${redirect}${reasonParam}`} replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/?denied=admin" replace />;
  }
  return <Outlet />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteSkeleton />}>
      <Routes>
        <Route element={<GuestOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/courses" element={<CoursesRoadmapPage />} />
            <Route path="/courses/:lessonId/study" element={<LessonStudyPage />} />
            <Route path="/courses/:lessonId/practice" element={<LessonPracticePage />} />
            <Route path="/review" element={<ReviewCenterPage />} />
            <Route path="/dictionary" element={<DictionaryPage />} />
            <Route path="/ai-chat" element={<AiChatPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
              <Route path="/admin/support" element={<AdminSupportPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
