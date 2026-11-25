import { httpClient } from '@/services/api/httpClient';
import type { NotificationItem } from '@/types/models';

export interface CreateNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  tone?: NotificationItem['tone'];
  targetRoute?: string;
}

export interface NotificationsListResponse {
  items: NotificationItem[];
  unreadCount: number;
}

export const notificationsApi = {
  async list(): Promise<NotificationsListResponse> {
    const raw = await httpClient.get<NotificationsListResponse | NotificationItem[]>(
      '/notifications',
    );
    if (Array.isArray(raw)) {
      return {
        items: raw,
        unreadCount: raw.filter((item) => !item.read).length,
      };
    }
    const items = Array.isArray(raw.items) ? raw.items : [];
    return {
      items,
      unreadCount:
        typeof raw.unreadCount === 'number'
          ? raw.unreadCount
          : items.filter((item) => !item.read).length,
    };
  },

  create(payload: CreateNotificationPayload): Promise<NotificationItem> {
    return httpClient.post<NotificationItem>('/notifications', payload);
  },

  markRead(id: number): Promise<null> {
    return httpClient.patch<null>(`/notifications/${id}/read`);
  },

  markAllRead(): Promise<null> {
    return httpClient.patch<null>('/notifications/read-all');
  },

  remove(id: number): Promise<null> {
    return httpClient.delete<null>(`/notifications/${id}`);
  },

  clearAll(): Promise<null> {
    return httpClient.delete<null>('/notifications');
  },
};
