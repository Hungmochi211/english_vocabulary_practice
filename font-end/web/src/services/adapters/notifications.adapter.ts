import type { NotificationItem } from '@/types/models';

export const NOTIFICATIONS_STORAGE_KEY = 'lexitag:v1:notifications';
export const NOTIFICATIONS_EVENT = 'lexitag:notifications-changed';

function readStorage(): NotificationItem[] {
  try {
    const raw = window.localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as NotificationItem[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(items: NotificationItem[]): void {
  try {
    window.localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_EVENT));
  } catch {
    // Ignore storage quota errors
  }
}

export const notificationsAdapter = {
  list(): NotificationItem[] {
    return readStorage();
  },

  push(entry: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>): NotificationItem {
    const item: NotificationItem = {
      ...entry,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...readStorage()];
    writeStorage(next);
    return item;
  },

  markRead(id: string): NotificationItem[] {
    const next = readStorage().map((item) => (item.id === id ? { ...item, read: true } : item));
    writeStorage(next);
    return next;
  },

  markAllRead(): NotificationItem[] {
    const next = readStorage().map((item) => ({ ...item, read: true }));
    writeStorage(next);
    return next;
  },

  remove(id: string): NotificationItem[] {
    const next = readStorage().filter((item) => item.id !== id);
    writeStorage(next);
    return next;
  },

  clear(): void {
    writeStorage([]);
  },
};
