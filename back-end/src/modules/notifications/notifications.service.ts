import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateNotificationDto } from './dto/notifications.dto';

export type NotificationTone = 'amber' | 'green' | 'blue' | 'purple';

export interface NotificationView {
  id: string;
  title: string;
  body: string;
  icon: string;
  tone: NotificationTone;
  targetRoute: string;
  read: boolean;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly dataSource: DataSource) {}

  private mapRow(row: {
    id: number | string;
    title: string;
    body: string;
    icon: string;
    tone: string;
    targetRoute: string;
    isRead: boolean;
    createdAt: Date | string;
  }): NotificationView {
    const validTone: NotificationTone =
      row.tone === 'amber' || row.tone === 'green' || row.tone === 'purple' ? row.tone : 'blue';
    return {
      id: String(row.id),
      title: row.title,
      body: row.body,
      icon: row.icon || 'bell',
      tone: validTone,
      targetRoute: row.targetRoute || '/',
      read: Boolean(row.isRead),
      createdAt:
        row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    };
  }

  async listForUser(
    userId: number,
  ): Promise<{ items: NotificationView[]; unreadCount: number }> {
    const rows: Array<{
      id: number;
      title: string;
      body: string;
      icon: string;
      tone: string;
      targetRoute: string;
      isRead: boolean;
      createdAt: Date | string;
    }> = await this.dataSource.query(
      `
      SELECT
        id,
        title,
        body,
        icon,
        tone::text AS tone,
        target_route AS "targetRoute",
        is_read AS "isRead",
        created_at AS "createdAt"
      FROM user_notifications
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 50;
      `,
      [userId],
    );

    const items = rows.map((r) => this.mapRow(r));
    const unreadCount = items.filter((item) => !item.read).length;
    return { items, unreadCount };
  }

  async createForUser(userId: number, dto: CreateNotificationDto): Promise<NotificationView> {
    const icon = (dto.icon?.trim() || 'bell').slice(0, 40);
    const tone: NotificationTone = dto.tone ?? 'blue';
    const rawRoute = dto.targetRoute?.trim() || '/';
    const targetRoute = rawRoute.startsWith('/') ? rawRoute.slice(0, 200) : '/';

    const rows = await this.dataSource.query(
      `
      INSERT INTO user_notifications (user_id, title, body, icon, tone, target_route)
      VALUES ($1, $2, $3, $4, $5::notification_tone_enum, $6)
      RETURNING
        id,
        title,
        body,
        icon,
        tone::text AS tone,
        target_route AS "targetRoute",
        is_read AS "isRead",
        created_at AS "createdAt";
      `,
      [userId, dto.title.trim().slice(0, 150), dto.body.trim().slice(0, 500), icon, tone, targetRoute],
    );

    return this.mapRow(rows[0]);
  }

  async markRead(userId: number, notificationId: number): Promise<void> {
    await this.dataSource.query(
      `
      UPDATE user_notifications
      SET is_read = TRUE
      WHERE id = $1 AND user_id = $2;
      `,
      [notificationId, userId],
    );
  }

  async markAllRead(userId: number): Promise<void> {
    await this.dataSource.query(
      `
      UPDATE user_notifications
      SET is_read = TRUE
      WHERE user_id = $1 AND is_read = FALSE;
      `,
      [userId],
    );
  }

  async removeOne(userId: number, notificationId: number): Promise<void> {
    await this.dataSource.query(
      `
      DELETE FROM user_notifications
      WHERE id = $1 AND user_id = $2;
      `,
      [notificationId, userId],
    );
  }

  async clearAll(userId: number): Promise<void> {
    await this.dataSource.query(
      `
      DELETE FROM user_notifications
      WHERE user_id = $1;
      `,
      [userId],
    );
  }
}
