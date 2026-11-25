import { randomInt } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AdminReplyTicketDto,
  AdminTicketQueryDto,
  CreateSupportTicketDto,
  SendSupportMessageDto,
} from './dto/support.dto';

export interface SupportMessageView {
  id: string;
  sender: 'me' | 'admin';
  senderRole: 'learner' | 'admin';
  text: string;
  createdAt: string;
}

export interface SupportTicketView {
  id: number;
  ticketId: string;
  userId: number;
  userFullName?: string;
  userEmail?: string;
  category: string;
  email: string;
  detail: string;
  status: 'open' | 'resolved';
  adminReply: string | null;
  repliedAt: string | null;
  submittedAt: string;
}

@Injectable()
export class SupportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  private toIso(val: Date | string | null | undefined): string {
    if (!val) return new Date().toISOString();
    return val instanceof Date ? val.toISOString() : String(val);
  }

  private mapMessageRow(row: {
    id: number | string;
    senderRole: string;
    content: string;
    createdAt: Date | string;
  }): SupportMessageView {
    const senderRole: 'learner' | 'admin' = row.senderRole === 'learner' ? 'learner' : 'admin';
    return {
      id: String(row.id),
      sender: senderRole === 'learner' ? 'me' : 'admin',
      senderRole,
      text: row.content,
      createdAt: this.toIso(row.createdAt),
    };
  }

  private mapTicketRow(row: {
    id: number;
    ticketCode: string;
    userId: number;
    userFullName?: string;
    userEmail?: string;
    category: string;
    contactEmail: string;
    detail: string;
    status: string;
    adminReply: string | null;
    repliedAt: Date | string | null;
    createdAt: Date | string;
  }): SupportTicketView {
    return {
      id: Number(row.id),
      ticketId: row.ticketCode,
      userId: Number(row.userId),
      userFullName: row.userFullName,
      userEmail: row.userEmail,
      category: row.category,
      email: row.contactEmail,
      detail: row.detail,
      status: row.status === 'resolved' ? 'resolved' : 'open',
      adminReply: row.adminReply ?? null,
      repliedAt: row.repliedAt ? this.toIso(row.repliedAt) : null,
      submittedAt: this.toIso(row.createdAt),
    };
  }

  async listLearnerMessages(userId: number): Promise<SupportMessageView[]> {
    const rows = await this.dataSource.query(
      `
      SELECT
        id,
        sender_role::text AS "senderRole",
        content,
        created_at AS "createdAt"
      FROM support_messages
      WHERE user_id = $1
      ORDER BY created_at ASC, id ASC
      LIMIT 200;
      `,
      [userId],
    );

    if (rows.length === 0) {
      return [
        {
          id: 'sup-welcome',
          sender: 'admin',
          senderRole: 'admin',
          text: 'Chào bạn! Đội ngũ Quản trị viên LexiTag luôn sẵn sàng hỗ trợ về tài khoản, lộ trình học và góp ý sản phẩm.',
          createdAt: new Date().toISOString(),
        },
      ];
    }

    return rows.map((r: { id: number; senderRole: string; content: string; createdAt: Date | string }) =>
      this.mapMessageRow(r),
    );
  }

  async sendLearnerMessage(
    userId: number,
    dto: SendSupportMessageDto,
  ): Promise<{ userMessage: SupportMessageView; replyMessage: SupportMessageView }> {
    const cleanText = dto.text.trim().slice(0, 1000);
    const userRows = await this.dataSource.query(
      `
      INSERT INTO support_messages (user_id, sender_role, sender_user_id, content)
      VALUES ($1, 'learner'::support_sender_role_enum, $2, $3)
      RETURNING id, sender_role::text AS "senderRole", content, created_at AS "createdAt";
      `,
      [userId, userId, cleanText],
    );

    const ackRows = await this.dataSource.query(
      `
      INSERT INTO support_messages (user_id, sender_role, sender_user_id, content)
      VALUES ($1, 'admin'::support_sender_role_enum, NULL, $2)
      RETURNING id, sender_role::text AS "senderRole", content, created_at AS "createdAt";
      `,
      [
        userId,
        'Cảm ơn bạn đã nhắn tin! QTV đã tiếp nhận yêu cầu và sẽ phản hồi sớm nhất qua hộp thư này hoặc thông báo tài khoản của bạn.',
      ],
    );

    return {
      userMessage: this.mapMessageRow(userRows[0]),
      replyMessage: this.mapMessageRow(ackRows[0]),
    };
  }

  async listLearnerTickets(userId: number): Promise<SupportTicketView[]> {
    const rows = await this.dataSource.query(
      `
      SELECT
        id,
        ticket_code AS "ticketCode",
        user_id AS "userId",
        category,
        contact_email AS "contactEmail",
        detail,
        status::text AS status,
        admin_reply AS "adminReply",
        replied_at AS "repliedAt",
        created_at AS "createdAt"
      FROM support_tickets
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT 50;
      `,
      [userId],
    );
    return rows.map((r: Parameters<SupportService['mapTicketRow']>[0]) => this.mapTicketRow(r));
  }

  async createTicket(userId: number, dto: CreateSupportTicketDto): Promise<SupportTicketView> {
    const ticketCode = `TK-${randomInt(100000, 999999)}`;
    const category = dto.category.trim().slice(0, 80);
    const email = dto.email.trim().toLowerCase().slice(0, 255);
    const detail = dto.detail.trim().slice(0, 2000);

    const rows = await this.dataSource.query(
      `
      INSERT INTO support_tickets (ticket_code, user_id, category, contact_email, detail)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        ticket_code AS "ticketCode",
        user_id AS "userId",
        category,
        contact_email AS "contactEmail",
        detail,
        status::text AS status,
        admin_reply AS "adminReply",
        replied_at AS "repliedAt",
        created_at AS "createdAt";
      `,
      [ticketCode, userId, category, email, detail],
    );

    try {
      await this.notificationsService.createForUser(userId, {
        title: `Đã tiếp nhận góp ý (${ticketCode})`,
        body: `Cảm ơn bạn đã gửi "${category}". Đội ngũ QTV sẽ xem xét sớm nhất.`,
        icon: 'message',
        tone: 'purple',
        targetRoute: '/',
      });
    } catch {
      // Không làm sập phản hồi gửi góp ý nếu thông báo gặp lỗi phụ
    }

    return this.mapTicketRow(rows[0]);
  }

  async listThreads() {
    const rows: Array<{
      userId: number;
      email: string;
      fullName: string;
      messageCount: number;
      lastMessage: string;
      lastSenderRole: string;
      lastMessageAt: Date | string;
    }> = await this.dataSource.query(
      `
      SELECT
        u.id AS "userId",
        u.email AS "email",
        u.full_name AS "fullName",
        COUNT(sm.id)::int AS "messageCount",
        (
          SELECT sm2.content
          FROM support_messages sm2
          WHERE sm2.user_id = u.id
          ORDER BY sm2.created_at DESC, sm2.id DESC
          LIMIT 1
        ) AS "lastMessage",
        (
          SELECT sm2.sender_role::text
          FROM support_messages sm2
          WHERE sm2.user_id = u.id
          ORDER BY sm2.created_at DESC, sm2.id DESC
          LIMIT 1
        ) AS "lastSenderRole",
        MAX(sm.created_at) AS "lastMessageAt"
      FROM support_messages sm
      INNER JOIN users u ON u.id = sm.user_id
      GROUP BY u.id, u.email, u.full_name
      ORDER BY MAX(sm.created_at) DESC;
      `,
    );

    return rows.map((r) => ({
      userId: Number(r.userId),
      email: r.email,
      fullName: r.fullName,
      messageCount: Number(r.messageCount),
      lastMessage: r.lastMessage ?? '',
      lastSenderRole: r.lastSenderRole === 'learner' ? 'learner' : 'admin',
      lastMessageAt: this.toIso(r.lastMessageAt),
    }));
  }

  async getThreadMessages(targetUserId: number): Promise<SupportMessageView[]> {
    const users = await this.dataSource.query(`SELECT id FROM users WHERE id = $1 LIMIT 1;`, [
      targetUserId,
    ]);
    if (users.length === 0) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản học viên',
      });
    }

    const rows = await this.dataSource.query(
      `
      SELECT
        id,
        sender_role::text AS "senderRole",
        content,
        created_at AS "createdAt"
      FROM support_messages
      WHERE user_id = $1
      ORDER BY created_at ASC, id ASC
      LIMIT 200;
      `,
      [targetUserId],
    );

    return rows.map((r: { id: number; senderRole: string; content: string; createdAt: Date | string }) =>
      this.mapMessageRow(r),
    );
  }

  async replyToThread(
    adminId: number,
    targetUserId: number,
    dto: SendSupportMessageDto,
    ipAddress?: string,
  ): Promise<SupportMessageView> {
    const users = await this.dataSource.query(`SELECT id FROM users WHERE id = $1 LIMIT 1;`, [
      targetUserId,
    ]);
    if (users.length === 0) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy tài khoản học viên',
      });
    }

    const cleanText = dto.text.trim().slice(0, 1000);
    const rows = await this.dataSource.query(
      `
      INSERT INTO support_messages (user_id, sender_role, sender_user_id, content)
      VALUES ($1, 'admin'::support_sender_role_enum, $2, $3)
      RETURNING id, sender_role::text AS "senderRole", content, created_at AS "createdAt";
      `,
      [targetUserId, adminId, cleanText],
    );

    await this.notificationsService.createForUser(targetUserId, {
      title: 'Phản hồi mới từ Quản trị viên',
      body: cleanText.slice(0, 180),
      icon: 'message',
      tone: 'blue',
      targetRoute: '/',
    });

    await this.auditService.log({
      actorUserId: adminId,
      action: 'ADMIN_SUPPORT_MESSAGE_SENT',
      targetType: 'user',
      targetId: targetUserId,
      status: 'SUCCESS',
      ipAddress: ipAddress ?? null,
    });

    return this.mapMessageRow(rows[0]);
  }

  async listTicketsPaginated(query: AdminTicketQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const filterSql = query.status ? `WHERE st.status = $1::support_ticket_status_enum` : ``;
    const filterParams = query.status ? [query.status] : [];

    const countRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM support_tickets st ${filterSql};`,
      filterParams,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const limitPlaceholder = query.status ? '$2' : '$1';
    const offsetPlaceholder = query.status ? '$3' : '$2';
    const rows = await this.dataSource.query(
      `
      SELECT
        st.id,
        st.ticket_code AS "ticketCode",
        st.user_id AS "userId",
        u.full_name AS "userFullName",
        u.email AS "userEmail",
        st.category,
        st.contact_email AS "contactEmail",
        st.detail,
        st.status::text AS status,
        st.admin_reply AS "adminReply",
        st.replied_at AS "repliedAt",
        st.created_at AS "createdAt"
      FROM support_tickets st
      INNER JOIN users u ON u.id = st.user_id
      ${filterSql}
      ORDER BY CASE WHEN st.status = 'open' THEN 0 ELSE 1 END ASC, st.created_at DESC, st.id DESC
      LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder};
      `,
      [...filterParams, limit, offset],
    );

    return {
      items: rows.map((r: Parameters<SupportService['mapTicketRow']>[0]) => this.mapTicketRow(r)),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async replyToTicket(
    adminId: number,
    ticketId: number,
    dto: AdminReplyTicketDto,
    ipAddress?: string,
  ): Promise<SupportTicketView> {
    const existingRows = await this.dataSource.query(
      `
      SELECT id, ticket_code AS "ticketCode", user_id AS "userId"
      FROM support_tickets
      WHERE id = $1
      LIMIT 1;
      `,
      [ticketId],
    );
    if (existingRows.length === 0) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Không tìm thấy phiếu góp ý',
      });
    }

    const existing = existingRows[0];
    const cleanReply = dto.reply.trim().slice(0, 2000);
    const nextStatus = dto.status ?? 'resolved';

    const updatedRows = await this.dataSource.query(
      `
      UPDATE support_tickets
      SET admin_reply = $1,
          status = $2::support_ticket_status_enum,
          replied_by_user_id = $3,
          replied_at = NOW(),
          updated_at = NOW()
      WHERE id = $4
      RETURNING
        id,
        ticket_code AS "ticketCode",
        user_id AS "userId",
        category,
        contact_email AS "contactEmail",
        detail,
        status::text AS status,
        admin_reply AS "adminReply",
        replied_at AS "repliedAt",
        created_at AS "createdAt";
      `,
      [cleanReply, nextStatus, adminId, ticketId],
    );

    const targetUserId = Number(existing.userId);
    const ticketCode = String(existing.ticketCode);

    await this.dataSource.query(
      `
      INSERT INTO support_messages (user_id, sender_role, sender_user_id, content)
      VALUES ($1, 'admin'::support_sender_role_enum, $2, $3);
      `,
      [targetUserId, adminId, `[Phản hồi phiếu ${ticketCode}] ${cleanReply.slice(0, 950)}`],
    );

    await this.notificationsService.createForUser(targetUserId, {
      title: `QTV đã phản hồi góp ý (${ticketCode})`,
      body: cleanReply.slice(0, 180),
      icon: 'message',
      tone: 'green',
      targetRoute: '/',
    });

    await this.auditService.log({
      actorUserId: adminId,
      action: 'ADMIN_SUPPORT_TICKET_REPLIED',
      targetType: 'support_ticket',
      targetId: ticketId,
      status: 'SUCCESS',
      metadata: { ticketCode, status: nextStatus },
      ipAddress: ipAddress ?? null,
    });

    return this.mapTicketRow(updatedRows[0]);
  }
}
