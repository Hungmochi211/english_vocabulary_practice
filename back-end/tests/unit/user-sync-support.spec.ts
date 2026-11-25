import { DataSource } from 'typeorm';
import { LearningService } from '../../src/modules/learning/learning.service';
import { DistractorService } from '../../src/modules/algorithm/distractor.service';
import { StratifiedSamplingService } from '../../src/modules/algorithm/stratified-sampling.service';
import { VocabularyService } from '../../src/modules/vocabulary/services/vocabulary.service';
import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { SupportService } from '../../src/modules/support/support.service';
import { AuditService } from '../../src/modules/audit/audit.service';

describe('User Sync & Support Services Unit Suite (US6 — FR-017..FR-020)', () => {
  it('US6-AS3 (History): returns submitted quiz attempts with graded word breakdown isolated by userId', async () => {
    const attempts = [
      {
        id: 42,
        lessonId: 1,
        lessonTitle: 'Greetings & Introductions',
        attemptType: 'lesson_practice',
        totalQuestions: 2,
        totalScore: 1.5,
        scorePercentage: 75,
        startedAt: '2026-11-25T05:00:00.000Z',
        submittedAt: '2026-11-25T05:01:25.000Z',
      },
    ];
    const answers = [
      {
        attemptId: 42,
        vocabularyId: 101,
        word: 'peaceful',
        phonetic: '/ˈpiːsfl/',
        meaning: 'yên bình',
        userAnswer: 'peaceful',
        gradingStatus: 'exact',
      },
      {
        attemptId: 42,
        vocabularyId: 102,
        word: 'phone',
        phonetic: '/fəʊn/',
        meaning: 'điện thoại',
        userAnswer: 'phoen',
        gradingStatus: 'near_match',
      },
    ];

    const dataSourceMock = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('FROM quiz_attempts a')) {
          expect(params?.[0]).toBe(7); // strictly filtered by userId = 7
          return attempts;
        }
        if (sql.includes('SELECT COUNT(*)::int AS total FROM quiz_attempts')) {
          return [{ total: 1 }];
        }
        if (sql.includes('FROM quiz_attempt_answers qa')) {
          expect(params?.[0]).toEqual([42]);
          return answers;
        }
        return [];
      }),
    } as unknown as DataSource;

    const service = new LearningService(
      dataSourceMock,
      {} as DistractorService,
      new StratifiedSamplingService(),
    );

    const res = await service.getHistoryPaginated(7, { page: 1, limit: 20 });
    expect(res.pagination.total).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({
      id: 'attempt-42',
      attemptId: 42,
      type: 'typing',
      title: 'Thực hành Bước 2 — Greetings & Introductions',
      correct: 1,
      total: 2,
      accuracy: 75,
      xp: 15,
      duration: '01:25',
    });
    expect(res.items[0].words).toHaveLength(2);
    expect(res.items[0].words[0].ok).toBe(true);
    expect(res.items[0].words[1].ok).toBe(false);
  });

  it('US6-AS4 (Saved Words): saves idempotently, lists by userId, and unsaves cleanly', async () => {
    const saved = new Map<string, { userId: number; vocabularyId: number; savedAt: string }>();
    const dataSourceMock = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('WHERE v.id = $1')) {
          if (params?.[0] === 101) {
            return [
              {
                id: 101,
                word: 'peaceful',
                cefrLevel: 'A1',
                partOfSpeech: 'adj.',
                phonetic: '/ˈpiːsfl/',
                vietnameseMeaning: 'yên bình',
              },
            ];
          }
          return [];
        }
        if (sql.includes('INSERT INTO user_saved_words')) {
          const userId = Number(params?.[0]);
          const vocabularyId = Number(params?.[1]);
          const key = `${userId}:${vocabularyId}`;
          const savedAt = saved.get(key)?.savedAt ?? '2026-11-25T06:00:00.000Z';
          saved.set(key, { userId, vocabularyId, savedAt });
          return [{ savedAt }];
        }
        if (sql.includes('FROM user_saved_words sw')) {
          const userId = Number(params?.[0]);
          return Array.from(saved.values())
            .filter((r) => r.userId === userId)
            .map((r) => ({
              vocabularyId: r.vocabularyId,
              word: 'peaceful',
              cefrLevel: 'A1',
              partOfSpeech: 'adj.',
              phonetic: '/ˈpiːsfl/',
              vietnameseMeaning: 'yên bình',
              savedAt: r.savedAt,
            }));
        }
        if (sql.includes('DELETE FROM user_saved_words')) {
          saved.delete(`${params?.[0]}:${params?.[1]}`);
          return [];
        }
        return [];
      }),
    } as unknown as DataSource;

    const service = new VocabularyService(dataSourceMock);
    await service.saveWord(10, 101);
    await service.saveWord(10, 101); // duplicate save is idempotent
    expect(await service.listSavedWords(10)).toHaveLength(1);
    expect(await service.listSavedWords(99)).toHaveLength(0); // isolated by userId

    await service.unsaveWord(10, 101);
    expect(await service.listSavedWords(10)).toHaveLength(0);
  });

  it('US6-AS5 (Notifications): creates, isolates by userId, marks read/read-all, and removes notifications', async () => {
    let seq = 1;
    const rows: Array<{
      id: number;
      userId: number;
      title: string;
      body: string;
      icon: string;
      tone: string;
      targetRoute: string;
      isRead: boolean;
      createdAt: string;
    }> = [];

    const dataSourceMock = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('INSERT INTO user_notifications')) {
          const created = {
            id: seq++,
            userId: Number(params?.[0]),
            title: String(params?.[1]),
            body: String(params?.[2]),
            icon: String(params?.[3]),
            tone: String(params?.[4]),
            targetRoute: String(params?.[5]),
            isRead: false,
            createdAt: '2026-11-25T07:00:00.000Z',
          };
          rows.unshift(created);
          return [created];
        }
        if (sql.includes('SELECT') && sql.includes('FROM user_notifications')) {
          const uid = Number(params?.[0]);
          return rows.filter((r) => r.userId === uid);
        }
        if (sql.includes('SET is_read = TRUE') && sql.includes('WHERE id = $1 AND user_id = $2')) {
          const id = Number(params?.[0]);
          const uid = Number(params?.[1]);
          rows.forEach((r) => {
            if (r.id === id && r.userId === uid) r.isRead = true;
          });
          return [];
        }
        if (sql.includes('SET is_read = TRUE') && sql.includes('WHERE user_id = $1')) {
          const uid = Number(params?.[0]);
          rows.forEach((r) => {
            if (r.userId === uid) r.isRead = true;
          });
          return [];
        }
        if (sql.includes('DELETE FROM user_notifications') && sql.includes('WHERE id = $1')) {
          const id = Number(params?.[0]);
          const uid = Number(params?.[1]);
          const idx = rows.findIndex((r) => r.id === id && r.userId === uid);
          if (idx >= 0) rows.splice(idx, 1);
          return [];
        }
        if (sql.includes('DELETE FROM user_notifications') && sql.includes('WHERE user_id = $1')) {
          const uid = Number(params?.[0]);
          for (let i = rows.length - 1; i >= 0; i -= 1) {
            if (rows[i].userId === uid) rows.splice(i, 1);
          }
          return [];
        }
        return [];
      }),
    } as unknown as DataSource;

    const service = new NotificationsService(dataSourceMock);
    const n1 = await service.createForUser(5, {
      title: 'Hoàn tất phiên ôn',
      body: 'Đạt 90%',
      icon: 'trophy',
      tone: 'green',
      targetRoute: '/history',
    });
    await service.createForUser(5, {
      title: 'Nhắc ôn tập 20:00',
      body: 'Còn 3 từ đến hạn',
      tone: 'amber',
    });

    expect((await service.listForUser(99)).items).toHaveLength(0);
    const listBefore = await service.listForUser(5);
    expect(listBefore.unreadCount).toBe(2);

    await service.markRead(99, Number(n1.id)); // wrong user cannot mark read
    expect((await service.listForUser(5)).unreadCount).toBe(2);

    await service.markRead(5, Number(n1.id));
    expect((await service.listForUser(5)).unreadCount).toBe(1);

    await service.markAllRead(5);
    expect((await service.listForUser(5)).unreadCount).toBe(0);

    await service.removeOne(5, Number(n1.id));
    expect((await service.listForUser(5)).items).toHaveLength(1);

    await service.clearAll(5);
    expect((await service.listForUser(5)).items).toHaveLength(0);
  });

  it('US6-AS6 (Support & Admin Support): persists learner chat/tickets and pushes notifications + audit logs on Admin reply', async () => {
    let msgSeq = 1;
    let ticketSeq = 1;
    const messages: Array<{
      id: number;
      userId: number;
      senderRole: string;
      senderUserId: number | null;
      content: string;
      createdAt: string;
    }> = [];
    const tickets: Array<{
      id: number;
      ticketCode: string;
      userId: number;
      category: string;
      contactEmail: string;
      detail: string;
      status: string;
      adminReply: string | null;
      repliedAt: string | null;
      createdAt: string;
    }> = [];

    const dataSourceMock = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('SELECT id FROM users WHERE id = $1')) {
          return Number(params?.[0]) === 7 ? [{ id: 7 }] : [];
        }
        if (sql.includes('INSERT INTO support_messages')) {
          const isAutoAck = sql.includes('NULL');
          const row = {
            id: msgSeq++,
            userId: Number(params?.[0]),
            senderRole: sql.includes("'learner'::support_sender_role_enum") ? 'learner' : 'admin',
            senderUserId: isAutoAck ? null : Number(params?.[1]),
            content: String(isAutoAck ? params?.[1] : params?.[2]),
            createdAt: '2026-11-25T07:30:00.000Z',
          };
          messages.push(row);
          return [row];
        }
        if (sql.includes('SELECT') && sql.includes('FROM support_messages') && !sql.includes('INNER JOIN users')) {
          const uid = Number(params?.[0]);
          return messages.filter((m) => m.userId === uid);
        }
        if (sql.includes('INSERT INTO support_tickets')) {
          const row = {
            id: ticketSeq++,
            ticketCode: String(params?.[0]),
            userId: Number(params?.[1]),
            category: String(params?.[2]),
            contactEmail: String(params?.[3]),
            detail: String(params?.[4]),
            status: 'open',
            adminReply: null,
            repliedAt: null,
            createdAt: '2026-11-25T07:35:00.000Z',
          };
          tickets.unshift(row);
          return [row];
        }
        if (sql.includes('SELECT id, ticket_code') && sql.includes('FROM support_tickets')) {
          const tid = Number(params?.[0]);
          return tickets.filter((t) => t.id === tid);
        }
        if (sql.includes('UPDATE support_tickets')) {
          const tid = Number(params?.[3]);
          const found = tickets.find((t) => t.id === tid)!;
          found.adminReply = String(params?.[0]);
          found.status = String(params?.[1]);
          found.repliedAt = '2026-11-25T07:40:00.000Z';
          return [found];
        }
        return [];
      }),
    } as unknown as DataSource;

    const notifMock = {
      createForUser: jest.fn(async () => ({
        id: '1',
        title: 'ok',
        body: 'ok',
        icon: 'message',
        tone: 'blue' as const,
        targetRoute: '/',
        read: false,
        createdAt: '2026-11-25T07:40:00.000Z',
      })),
    } as unknown as NotificationsService;

    const auditMock = {
      log: jest.fn(async () => undefined),
    } as unknown as AuditService;

    const support = new SupportService(dataSourceMock, notifMock, auditMock);

    // Welcome message when empty
    const initialMsgs = await support.listLearnerMessages(7);
    expect(initialMsgs).toHaveLength(1);
    expect(initialMsgs[0].id).toBe('sup-welcome');

    // Learner sends message -> stored + auto-ack
    const sent = await support.sendLearnerMessage(7, { text: 'Cho em hỏi về lộ trình B1' });
    expect(sent.userMessage.sender).toBe('me');
    expect(sent.replyMessage.sender).toBe('admin');

    // Admin replies directly to learner thread -> notification + audit log
    const adminReplyMsg = await support.replyToThread(99, 7, { text: 'Chào em, em vào mục Khóa học nhé!' }, '127.0.0.1');
    expect(adminReplyMsg.sender).toBe('admin');
    expect(notifMock.createForUser).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ title: 'Phản hồi mới từ Quản trị viên' }),
    );
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_SUPPORT_MESSAGE_SENT', targetId: 7 }),
    );

    // Learner submits ticket -> Admin replies and resolves ticket
    const ticket = await support.createTicket(7, {
      category: 'Góp ý tính năng',
      email: 'learner@vnua.edu.vn',
      detail: 'Đề xuất bổ sung thêm bài nghe chủ đề Du lịch.',
    });
    expect(ticket.ticketId).toMatch(/^TK-\d{6}$/);

    const resolved = await support.replyToTicket(
      99,
      ticket.id,
      { reply: 'Cảm ơn góp ý của bạn, nhóm đã ghi nhận cho đợt cập nhật tới!' },
      '127.0.0.1',
    );
    expect(resolved.status).toBe('resolved');
    expect(resolved.adminReply).toContain('nhóm đã ghi nhận');
    expect(auditMock.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_SUPPORT_TICKET_REPLIED', targetId: ticket.id }),
    );
  });
});
