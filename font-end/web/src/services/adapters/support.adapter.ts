import type { SupportMessage } from '@/types/models';

export const SUPPORT_MESSAGES_KEY = 'lexitag:v1:support-messages';
export const SUPPORT_TICKETS_KEY = 'lexitag:v1:support-tickets';

export interface SupportTicketPayload {
  category: string;
  email: string;
  detail: string;
}

function readMessages(): SupportMessage[] {
  try {
    const raw = window.localStorage.getItem(SUPPORT_MESSAGES_KEY);
    if (!raw) {
      return [
        {
          id: 'sup-welcome',
          sender: 'admin',
          text: 'Chào bạn! Đội ngũ Quản trị viên LexiTag luôn sẵn sàng hỗ trợ về tài khoản, lộ trình CEFR và góp ý sản phẩm.',
          createdAt: new Date().toISOString(),
        },
      ];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SupportMessage[]) : [];
  } catch {
    return [];
  }
}

function writeMessages(messages: SupportMessage[]): void {
  try {
    window.localStorage.setItem(SUPPORT_MESSAGES_KEY, JSON.stringify(messages.slice(-50)));
  } catch {
    // Ignore storage quota errors
  }
}

export const supportAdapter = {
  listMessages(): SupportMessage[] {
    return readMessages();
  },

  async sendMessage(
    text: string,
  ): Promise<{ userMessage: SupportMessage; replyMessage: SupportMessage }> {
    const now = Date.now();
    const userMessage: SupportMessage = {
      id: `sup-u-${now}`,
      sender: 'me',
      text: text.trim(),
      createdAt: new Date(now).toISOString(),
    };
    const replyMessage: SupportMessage = {
      id: `sup-a-${now + 1}`,
      sender: 'admin',
      text: 'Cảm ơn bạn đã nhắn tin! QTV đã tiếp nhận yêu cầu và sẽ phản hồi sớm nhất qua hộp thư này hoặc email tài khoản của bạn.',
      createdAt: new Date(now + 1).toISOString(),
    };
    const next = [...readMessages(), userMessage, replyMessage];
    writeMessages(next);
    return { userMessage, replyMessage };
  },

  async submitFeedback(
    payload: SupportTicketPayload,
  ): Promise<{ ticketId: string; submittedAt: string }> {
    const ticketId = `TK-${Date.now().toString().slice(-6)}`;
    const submittedAt = new Date().toISOString();
    try {
      const raw = window.localStorage.getItem(SUPPORT_TICKETS_KEY);
      const list = raw ? (JSON.parse(raw) as unknown[]) : [];
      list.unshift({ ticketId, submittedAt, ...payload });
      window.localStorage.setItem(SUPPORT_TICKETS_KEY, JSON.stringify(list.slice(0, 30)));
    } catch {
      // Ignore storage quota errors
    }
    return { ticketId, submittedAt };
  },
};
