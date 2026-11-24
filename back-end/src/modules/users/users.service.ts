import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import {
  UpdateProfileDto,
  AdminPaginationQueryDto,
  AdminUpdateStatusDto,
} from './dto/users.dto';
import { getTodayUtc7Date, addDaysUtc7 } from '../../common/utils/timezone.util';

@Injectable()
export class UsersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async getMyProfile(userId: number) {
    const rows = await this.dataSource.query(
      `
      SELECT
        u.id,
        u.email,
        u.full_name AS "fullName",
        u.avatar_url AS "avatarUrl",
        u.target_level AS "targetLevel",
        u.role,
        u.auth_provider AS "authProvider",
        u.email_reminder_enabled AS "emailReminderEnabled",
        u.is_active AS "isActive",
        u.created_at AS "createdAt",
        COALESCE(s.current_streak, 0) AS "rawCurrentStreak",
        COALESCE(s.longest_streak, 0) AS "longestStreak",
        TO_CHAR(s.last_study_date, 'YYYY-MM-DD') AS "lastStudyDate"
      FROM users u
      LEFT JOIN user_streaks s ON s.user_id = u.id
      WHERE u.id = $1;
      `,
      [userId],
    );

    if (rows.length === 0) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Người dùng không tồn tại',
        details: null,
      });
    }

    const row = rows[0];
    const today = getTodayUtc7Date();
    const yesterday = addDaysUtc7(today, -1);
    const effectiveCurrentStreak =
      row.lastStudyDate && row.lastStudyDate >= yesterday ? row.rawCurrentStreak : 0;

    return {
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      avatarUrl: row.avatarUrl,
      targetLevel: row.targetLevel,
      role: row.role,
      authProvider: row.authProvider,
      emailReminderEnabled: row.emailReminderEnabled,
      isActive: row.isActive,
      currentStreak: effectiveCurrentStreak,
      longestStreak: row.longestStreak,
      lastStudyDate: row.lastStudyDate,
      createdAt: row.createdAt,
    };
  }

  async updateMyProfile(userId: number, dto: UpdateProfileDto) {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (dto.fullName !== undefined) {
      params.push(dto.fullName.trim());
      setClauses.push(`full_name = $${params.length}`);
    }
    if (dto.avatarUrl !== undefined) {
      params.push(dto.avatarUrl);
      setClauses.push(`avatar_url = $${params.length}`);
    }
    if (dto.targetLevel !== undefined) {
      params.push(dto.targetLevel);
      setClauses.push(`target_level = $${params.length}::cefr_level_enum`);
    }
    if (dto.emailReminderEnabled !== undefined) {
      params.push(dto.emailReminderEnabled);
      setClauses.push(`email_reminder_enabled = $${params.length}`);
    }

    if (setClauses.length > 0) {
      params.push(userId);
      await this.dataSource.query(
        `
        UPDATE users
        SET ${setClauses.join(', ')}, updated_at = NOW()
        WHERE id = $${params.length};
        `,
        params,
      );
    }

    return this.getMyProfile(userId);
  }

  async listUsersPaginated(query: AdminPaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const [items, totalRows] = await Promise.all([
      this.dataSource.query(
        `
        SELECT
          u.id,
          u.email,
          u.full_name AS "fullName",
          u.avatar_url AS "avatarUrl",
          u.target_level AS "targetLevel",
          u.role,
          u.auth_provider AS "authProvider",
          u.email_reminder_enabled AS "emailReminderEnabled",
          u.is_active AS "isActive",
          u.created_at AS "createdAt"
        FROM users u
        ORDER BY u.id DESC
        LIMIT $1 OFFSET $2;
        `,
        [limit, offset],
      ),
      this.dataSource.query(`SELECT COUNT(*)::int AS total FROM users;`),
    ]);

    const total = totalRows[0]?.total ?? 0;
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUserStatus(
    adminId: number,
    targetUserId: number,
    dto: AdminUpdateStatusDto,
    ipAddress?: string | null,
  ) {
    const updated = await this.dataSource.query(
      `
      UPDATE users
      SET is_active = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id;
      `,
      [dto.isActive, targetUserId],
    );

    const updatedRows = Array.isArray(updated[0]) ? updated[0] : updated;
    if (updatedRows.length === 0) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Người dùng không tồn tại',
        details: null,
      });
    }

    if (!dto.isActive) {
      await this.dataSource.query(
        `
        UPDATE refresh_sessions
        SET is_revoked = TRUE, revoked_at = COALESCE(revoked_at, NOW())
        WHERE user_id = $1 AND is_revoked = FALSE;
        `,
        [targetUserId],
      );
    }

    await this.auditService.log({
      actorUserId: adminId,
      action: dto.isActive ? 'ADMIN_USER_ENABLED' : 'ADMIN_USER_DISABLED',
      targetType: 'user',
      targetId: targetUserId,
      status: 'SUCCESS',
      ipAddress,
    });

    return null;
  }

  async listAuditLogsPaginated(query: AdminPaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const [items, totalRows] = await Promise.all([
      this.dataSource.query(
        `
        SELECT
          id,
          actor_user_id AS "actorUserId",
          action,
          target_type AS "targetType",
          target_id AS "targetId",
          status,
          metadata,
          ip_address AS "ipAddress",
          created_at AS "createdAt"
        FROM audit_logs
        ORDER BY created_at DESC, id DESC
        LIMIT $1 OFFSET $2;
        `,
        [limit, offset],
      ),
      this.dataSource.query(`SELECT COUNT(*)::int AS total FROM audit_logs;`),
    ]);

    const total = totalRows[0]?.total ?? 0;
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
