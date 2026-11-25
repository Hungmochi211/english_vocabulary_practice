import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, History, LogOut, Moon, Settings, Shield, Sun, User } from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { useTheme } from '@/app/ThemeProvider';
import { getInitials } from '@/utils/formatters';

export const OPEN_SUPPORT_WIDGET_EVENT = 'lexitag:open-support';

interface AccountMenuProps {
  onRequestLogout: () => void;
}

interface MenuEntry {
  id: string;
  label: string;
  icon: typeof User;
  danger?: boolean;
  onSelect: () => void;
}

export function AccountMenu({ onRequestLogout }: AccountMenuProps) {
  const { user, isAdmin } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const menuId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const avatarBtnRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const displayName = user?.fullName || 'Học viên';
  const email = user?.email || '';
  const targetLevel = user?.targetLevel || 'B2';
  const initials = getInitials(displayName);

  const close = useCallback((returnFocus = false) => {
    setOpen((prev) => {
      if (!prev) return prev;
      return false;
    });
    if (returnFocus) {
      avatarBtnRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const primaryItems = useMemo<MenuEntry[]>(() => {
    const list: MenuEntry[] = [
      {
        id: 'profile',
        label: 'Hồ sơ cá nhân',
        icon: User,
        onSelect: () => navigate('/profile'),
      },
      {
        id: 'history',
        label: 'Lịch sử học tập',
        icon: History,
        onSelect: () => navigate('/history'),
      },
      {
        id: 'settings',
        label: 'Cài đặt & Bảo mật',
        icon: Settings,
        onSelect: () => navigate('/profile'),
      },
      {
        id: 'theme',
        label: isDark ? 'Giao diện sáng' : 'Giao diện tối',
        icon: isDark ? Sun : Moon,
        onSelect: toggleTheme,
      },
      {
        id: 'help',
        label: 'Hỗ trợ & Góp ý',
        icon: HelpCircle,
        onSelect: () => window.dispatchEvent(new CustomEvent(OPEN_SUPPORT_WIDGET_EVENT)),
      },
    ];
    if (isAdmin) {
      list.splice(3, 0, {
        id: 'admin',
        label: 'Quản trị hệ thống',
        icon: Shield,
        onSelect: () => navigate('/admin'),
      });
    }
    return list;
  }, [isAdmin, isDark, navigate, toggleTheme]);

  const allItems = useMemo<MenuEntry[]>(
    () => [
      ...primaryItems,
      {
        id: 'logout',
        label: 'Đăng xuất',
        icon: LogOut,
        danger: true,
        onSelect: onRequestLogout,
      },
    ],
    [onRequestLogout, primaryItems],
  );

  const openMenu = useCallback(
    (focusIndex?: number) => {
      setOpen(true);
      if (focusIndex !== undefined) {
        const count = allItems.length;
        const targetIdx = ((focusIndex % count) + count) % count;
        window.requestAnimationFrame(() => {
          itemRefs.current[targetIdx]?.focus({ preventScroll: true });
        });
      }
    },
    [allItems.length],
  );

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [close, open]);

  function handleAvatarKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu(e.key === 'ArrowDown' ? 0 : -1);
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      close(false);
    }
  }

  function handleMenuKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const activeEl = document.activeElement as HTMLButtonElement | null;
    const currentIdx = itemRefs.current.indexOf(activeEl);
    const count = allItems.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = currentIdx < 0 ? 0 : (currentIdx + 1) % count;
      itemRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = currentIdx < 0 ? count - 1 : (currentIdx - 1 + count) % count;
      itemRefs.current[prev]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      itemRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      itemRefs.current[count - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') {
      close(false);
    }
  }

  const separatorIndex = primaryItems.length + 1;
  const logoutIndex = primaryItems.length + 2;

  return (
    <div ref={rootRef} className={`acct-menu ${open ? 'is-open' : ''}`}>
      <div className="relative">
        <button
          ref={avatarBtnRef}
          type="button"
          className="acct-menu-av"
          aria-label="Mở menu tài khoản"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => (open ? close(false) : openMenu())}
          onKeyDown={handleAvatarKeyDown}
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </button>
        <span className="acct-menu-dot" aria-hidden="true" />
      </div>

      <div
        id={menuId}
        role="menu"
        aria-label="Menu tài khoản"
        aria-hidden={!open}
        className="acct-menu-panel"
        onKeyDown={handleMenuKeyDown}
      >
        <div className="acct-menu-hd" style={{ '--i': 0 } as CSSProperties}>
          <div className="flex items-center justify-between gap-2">
            <b className="truncate">{displayName}</b>
            <span className="shrink-0 rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-extrabold text-indigo-700">
              {targetLevel}
            </span>
          </div>
          {email && <span className="acct-menu-email truncate">{email}</span>}
        </div>

        {primaryItems.map((entry, idx) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              ref={(el) => {
                itemRefs.current[idx] = el;
              }}
              type="button"
              role="menuitem"
              tabIndex={open ? 0 : -1}
              className="acct-menu-item"
              style={{ '--i': idx + 1 } as CSSProperties}
              onClick={() => {
                close(false);
                entry.onSelect();
              }}
            >
              <Icon className="acct-menu-icon" aria-hidden="true" />
              <span>{entry.label}</span>
            </button>
          );
        })}

        <div
          className="acct-menu-hr"
          role="separator"
          style={{ '--i': separatorIndex } as CSSProperties}
        />

        <button
          ref={(el) => {
            itemRefs.current[primaryItems.length] = el;
          }}
          type="button"
          role="menuitem"
          tabIndex={open ? 0 : -1}
          className="acct-menu-item is-out"
          style={{ '--i': logoutIndex } as CSSProperties}
          onClick={() => {
            close(false);
            onRequestLogout();
          }}
        >
          <LogOut className="acct-menu-icon" aria-hidden="true" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}
