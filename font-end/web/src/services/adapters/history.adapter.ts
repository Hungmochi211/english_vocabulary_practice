import type { ActivityHistoryItem } from '@/types/models';

export const HISTORY_STORAGE_KEY = 'lexitag:v1:history';
export const HISTORY_EVENT = 'lexitag:history-changed';

function readStorage(): ActivityHistoryItem[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ActivityHistoryItem[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(items: ActivityHistoryItem[]): void {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items.slice(0, 100)));
    window.dispatchEvent(new CustomEvent(HISTORY_EVENT));
  } catch {
    // Ignore storage quota errors
  }
}

export const historyAdapter = {
  list(): ActivityHistoryItem[] {
    return readStorage();
  },

  record(entry: Omit<ActivityHistoryItem, 'id' | 'createdAt'>): ActivityHistoryItem {
    const item: ActivityHistoryItem = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    const next = [item, ...readStorage()];
    writeStorage(next);
    return item;
  },

  clear(): void {
    writeStorage([]);
  },
};
