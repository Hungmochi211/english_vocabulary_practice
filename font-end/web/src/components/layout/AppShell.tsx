import { useRef, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Bot,
  Flame,
  GraduationCap,
  History,
  Home,
  LogOut,
  Menu,
  Search,
  Settings,
  Shield,
  User,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { httpClient } from '@/services/api/httpClient';
import { formatXp, getInitials } from '@/utils/formatters';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { LogoutModal } from '@/features/auth/LogoutModal';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { AccountMenu } from '@/components/layout/AccountMenu';
import { FloatingSupportWidget } from '@/components/support/FloatingSupportWidget';
import type { StatsOverview } from '@/types/models';

const NAV_ITEMS = [
  { to: '/', label: 'Trang chủ', icon: Home, end: true },
  { to: '/courses', label: 'Khóa học', icon: BookOpen },
  { to: '/review', label: 'Ôn tập', icon: GraduationCap },
  { to: '/dictionary', label: 'Tra từ', icon: Search },
  { to: '/ai-chat', label: 'Trợ lý AI', icon: Bot },
  { to: '/history', label: 'Lịch sử', icon: History },
  { to: '/profile', label: 'Trang cá nhân', icon: User },
];

export function AppShell() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchText, setSearchText] = useState('');

  const { data: overview } = useQuery({
    queryKey: ['stats', 'overview'],
    queryFn: () => httpClient.get<StatsOverview>('/stats/overview'),
  });

  useKeyboardShortcuts({
    onQuickSearch: () => {
      navigate('/dictionary');
      window.setTimeout(() => searchInputRef.current?.focus(), 40);
    },
    onEscape: () => {
      setDrawerOpen(false);
      setLogoutOpen(false);
    },
  });

  function handleQuickSearch(e: FormEvent) {
    e.preventDefault();
    const q = searchText.trim();
    navigate(q ? `/dictionary?q=${encodeURIComponent(q)}` : '/dictionary');
  }

  async function handleConfirmLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
      setLogoutOpen(false);
    }
  }

  const displayName = user?.fullName || 'Học viên';
  const initials = getInitials(displayName);
  const streakDays = overview?.currentStreak ?? 0;
  const totalXp = overview?.totalXp ?? 0;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      {/* Mobile Drawer Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/35 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white px-4 py-5 transition-transform lg:translate-x-0 ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
          <button
            type="button"
            onClick={() => {
              navigate('/');
              setDrawerOpen(false);
            }}
            className="flex items-center gap-3 text-left"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700">
              <BookOpen className="h-5 w-5" />
            </span>
            <span>
              <strong className="font-heading block text-lg font-extrabold leading-tight text-slate-900">
                LexiTag
              </strong>
              <small className="block text-[10px] font-bold tracking-widest text-slate-500">
                LEARNING LAB
              </small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Đóng menu"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Điều hướng chính" className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'border border-indigo-100 bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-4.5 w-4.5" />
              <span>{label}</span>
            </NavLink>
          ))}

          {isAdmin && (
            <NavLink
              to="/admin"
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                `mt-2 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'border border-amber-200 bg-amber-50 text-amber-800'
                    : 'text-amber-700 hover:bg-amber-50/70'
                }`
              }
            >
              <Shield className="h-4.5 w-4.5" />
              <span>Quản trị hệ thống</span>
            </NavLink>
          )}
        </nav>

        <div className="mt-auto border-t border-slate-100 pt-4">
          <div className="mb-3 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => {
                navigate('/profile');
                setDrawerOpen(false);
              }}
              className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <Settings className="h-4 w-4" />
              <span>Cài đặt</span>
            </button>
            <button
              type="button"
              onClick={() => setLogoutOpen(true)}
              aria-label="Đăng xuất"
              title="Đăng xuất"
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              <span>Đăng xuất</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              navigate('/profile');
              setDrawerOpen(false);
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50/60"
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-xs font-bold text-white">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm font-bold text-slate-900">{displayName}</strong>
              <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                <b className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                  {user?.targetLevel || 'B2'}
                </b>
                <span>{isAdmin ? 'Admin' : 'Học viên'}</span>
              </span>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Mở menu"
              className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <form
              onSubmit={handleQuickSearch}
              role="search"
              className="flex w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-indigo-400 focus-within:bg-white"
            >
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tra nhanh từ vựng, chủ đề... (Ctrl+K)"
                aria-label="Tra nhanh từ vựng"
                className="w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
            </form>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <span
              title="Chuỗi ngày học liên tiếp"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800"
            >
              <Flame className="h-4 w-4 text-amber-600" />
              <span>{streakDays} ngày</span>
            </span>

            <span
              title="Tổng điểm XP tích lũy"
              data-testid="topbar-xp"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800"
            >
              <Zap className="h-4 w-4 text-slate-700" />
              <span>{formatXp(totalXp)} XP</span>
            </span>

            <NotificationBell />

            <AccountMenu onRequestLogout={() => setLogoutOpen(true)} />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>

      <LogoutModal
        open={logoutOpen}
        userName={displayName}
        loading={loggingOut}
        onConfirm={handleConfirmLogout}
        onCancel={() => setLogoutOpen(false)}
      />

      <FloatingSupportWidget />
    </div>
  );
}