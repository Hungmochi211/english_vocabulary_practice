import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import {
  NOTIFICATIONS_EVENT,
  notificationsAdapter,
} from '@/services/adapters/notifications.adapter';
import type { NotificationItem } from '@/types/models';

const TONE_DOT: Record<NotificationItem['tone'], string> = {
  amber: 'bg-amber-500',
  green: 'bg-emerald-500',
  blue: 'bg-sky-500',
  purple: 'bg-indigo-500',
};

export function NotificationBell() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [items, setItems] = useState<NotificationItem[]>(() => notificationsAdapter.list());

  useEffect(() => {
    const sync = () => setItems(notificationsAdapter.list());
    window.addEventListener(NOTIFICATIONS_EVENT, sync);
    void notificationsAdapter.syncFromServer();
    return () => window.removeEventListener(NOTIFICATIONS_EVENT, sync);
  }, []);

  useEffect(() => {
    if (open) {
      void notificationsAdapter.syncFromServer();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  const unreadCount = items.filter((item) => !item.read).length;
  const visibleItems = tab === 'unread' ? items.filter((item) => !item.read) : items;

  function handleOpenItem(item: NotificationItem) {
    setItems(notificationsAdapter.markRead(item.id));
    setOpen(false);
    if (item.targetRoute) {
      navigate(item.targetRoute);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Thông báo"
        title="Thông báo"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span
            data-testid="notif-unread-dot"
            aria-label={`${unreadCount} thông báo chưa đọc`}
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold text-white"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Trung tâm thông báo"
          className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-heading text-sm font-extrabold text-slate-900">
              Thông báo ({unreadCount} mới)
            </h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => setItems(notificationsAdapter.markAllRead())}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Đánh dấu đã đọc tất cả</span>
              </button>
            )}
          </div>

          <div className="flex gap-1 border-b border-slate-100 px-4 py-2">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`rounded-lg px-3 py-1 text-xs font-bold ${
                tab === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tất cả ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('unread')}
              className={`rounded-lg px-3 py-1 text-xs font-bold ${
                tab === 'unread' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Chưa đọc ({unreadCount})
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {visibleItems.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-500">
                {tab === 'unread' ? 'Bạn đã đọc hết mọi thông báo.' : 'Chưa có thông báo nào.'}
              </p>
            ) : (
              visibleItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50 ${
                    item.read ? 'bg-white' : 'bg-indigo-50/40'
                  }`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[item.tone]}`} />
                  <button
                    type="button"
                    onClick={() => handleOpenItem(item)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-xs font-bold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{item.body}</p>
                  </button>
                  <button
                    type="button"
                    aria-label="Xóa thông báo"
                    onClick={() => setItems(notificationsAdapter.remove(item.id))}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}