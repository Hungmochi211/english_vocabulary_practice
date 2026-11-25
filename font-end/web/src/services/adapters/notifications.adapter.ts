import { getStoredSession } from '@/services/api/httpClient';
import { notificationsApi } from '@/services/api/notifications.api';
import type { NotificationItem } from '@/types/models';

export const NOTIFICATIONS_STORAGE_KEY = 'lexitag:v1:notifications';
export const NOTIFICATIONS_EVENT = 'lexitag:notifications-changed';

let mutationSeq = 0;
const inFlightWrites = new Set<Promise<unknown>>();

function trackWrite(promise: Promise<unknown>): void {
  inFlightWrites.add(promise);
  void promise.finally(() => {
    inFlightWrites.delete(promise);
  });
}

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

  async syncFromServer(): Promise<NotificationItem[]> {
    if (!getStoredSession()?.accessToken) {
      return readStorage();
    }
    try {
      if (inFlightWrites.size > 0) {
        await Promise.allSettled(Array.from(inFlightWrites));
      }
      const seqAtStart = mutationSeq;
      const serverRes = await notificationsApi.list();
      if (mutationSeq !== seqAtStart) {
        return readStorage();
      }

      const localItems = readStorage();
      if (serverRes.items.length === 0 && localItems.length > 0) {
        const migrated: NotificationItem[] = [];
        for (const item of [...localItems].reverse()) {
          try {
            const created = await notificationsApi.create({
              title: item.title,
              body: item.body,
              icon: item.icon,
              tone: item.tone,
              targetRoute: item.targetRoute,
            });
            if (item.read && /^\d+$/.test(created.id)) {
              await notificationsApi.markRead(Number(created.id)).catch(() => undefined);
            }
            migrated.unshift({ ...created, read: item.read });
          } catch {
            migrated.unshift(item);
          }
        }
        if (mutationSeq === seqAtStart) {
          writeStorage(migrated);
        }
        return readStorage();
      }

      writeStorage(serverRes.items);
      return serverRes.items;
    } catch {
      return readStorage();
    }
  },

  push(entry: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>): NotificationItem {
    mutationSeq += 1;
    const tempItem: NotificationItem = {
      ...entry,
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    const next = [tempItem, ...readStorage()];
    writeStorage(next);

    if (getStoredSession()?.accessToken) {
      const req = notificationsApi
        .create({
          title: entry.title,
          body: entry.body,
          icon: entry.icon,
          tone: entry.tone,
          targetRoute: entry.targetRoute,
        })
        .then(async (created) => {
          const current = readStorage();
          const idx = current.findIndex((item) => item.id === tempItem.id);
          if (idx === -1) {
            if (/^\d+$/.test(created.id)) {
              await notificationsApi.remove(Number(created.id)).catch(() => undefined);
            }
            return;
          }
          const wasRead = current[idx].read;
          const updated = [...current];
          updated[idx] = { ...created, read: wasRead || created.read };
          writeStorage(updated);
          if (wasRead && !created.read && /^\d+$/.test(created.id)) {
            await notificationsApi.markRead(Number(created.id)).catch(() => undefined);
          }
        })
        .catch(() => undefined);
      trackWrite(req);
    }

    return tempItem;
  },

  markRead(id: string): NotificationItem[] {
    mutationSeq += 1;
    const next = readStorage().map((item) => (item.id === id ? { ...item, read: true } : item));
    writeStorage(next);
    if (getStoredSession()?.accessToken && /^\d+$/.test(id)) {
      trackWrite(notificationsApi.markRead(Number(id)).catch(() => undefined));
    }
    return next;
  },

  markAllRead(): NotificationItem[] {
    mutationSeq += 1;
    const next = readStorage().map((item) => ({ ...item, read: true }));
    writeStorage(next);
    if (getStoredSession()?.accessToken) {
      trackWrite(notificationsApi.markAllRead().catch(() => undefined));
    }
    return next;
  },

  remove(id: string): NotificationItem[] {
    mutationSeq += 1;
    const next = readStorage().filter((item) => item.id !== id);
    writeStorage(next);
    if (getStoredSession()?.accessToken && /^\d+$/.test(id)) {
      trackWrite(notificationsApi.remove(Number(id)).catch(() => undefined));
    }
    return next;
  },

  clear(): void {
    mutationSeq += 1;
    writeStorage([]);
  },

  clearAllOnServer(): void {
    mutationSeq += 1;
    writeStorage([]);
    if (getStoredSession()?.accessToken) {
      trackWrite(notificationsApi.clearAll().catch(() => undefined));
    }
  },
};
