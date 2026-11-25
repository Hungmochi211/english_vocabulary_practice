import { getStoredSession } from '@/services/api/httpClient';
import { supportApi } from '@/services/api/support.api';
import type { SupportMessage } from '@/types/models';

export const SUPPORT_MESSAGES_KEY = 'lexitag:v1:support-messages';
export const SUPPORT_TICKETS_KEY = 'lexitag:v1:support-tickets';
export const SUPPORT_EVENT = 'lexitag:support-changed';

export interface SupportTicketPayload {
  category: string;
  email: string;
  detail: string;
}

function defaultWelcomeMessage(): SupportMessage {
  return {
    id: 'sup-welcome',
    sender: 'admin',
    senderRole: 'admin',
    text: 'Chào bạn! Đội ngũ Quản trị viên LexiTag luôn sẵn sàng hỗ trợ về tài khoản, lộ trình học và góp ý sản phẩm.',
    createdAt: new Date().toISOString(),
  };
}

function readMessages(): SupportMessage[] {
  try {
    const raw = window.localStorage.getItem(SUPPORT_MESSAGES_KEY);
    if (!raw) {
      return [defaultWelcomeMessage()];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? (parsed as SupportMessage[])
      : [defaultWelcomeMessage()];
  } catch {
    return [defaultWelcomeMessage()];
  }
}

function writeMessages(messages: SupportMessage[]): void {
  try {
    window.localStorage.setItem(SUPPORT_MESSAGES_KEY, JSON.stringify(messages.slice(-100)));
    window.dispatchEvent(new CustomEvent(SUPPORT_EVENT));
  } catch {
    // Ignore storage quota errors
  }
}

export const supportAdapter = {
  listMessages(): SupportMessage[] {
    return readMessages();
  },

  async syncMessagesFromServer(): Promise<SupportMessage[]> {
    if (!getStoredSession()?.accessToken) {
      return readMessages();
    }
    try {
      const serverMessages = await supportApi.listMessages();
      if (serverMessages.length > 0) {
        writeMessages(serverMessages);
        return serverMessages;
      }
      return readMessages();
    } catch {
      return readMessages();
    }
  },

  async sendMessage(
    text: string,
  ): Promise<{ userMessage: SupportMessage; replyMessage: SupportMessage }> {
    const cleanText = text.trim();
    if (getStoredSession()?.accessToken) {
      try {
        const res = await supportApi.sendMessage(cleanText);
        const existing = readMessages();
        const next = [...existing, res.userMessage, res.replyMessage];
        writeMessages(next);
        return res;
      } catch {
        // Fallback sang lưu cục bộ nếu tạm mất mạng
      }
    }

    const now = Date.now();
    const userMessage: SupportMessage = {
      id: `sup-u-${now}`,
      sender: 'me',
      senderRole: 'learner',
      text: cleanText,
      createdAt: new Date(now).toISOString(),
    };
    const replyMessage: SupportMessage = {
      id: `sup-a-${now + 1}`,
      sender: 'admin',
      senderRole: 'admin',
      text: 'Cảm ơn bạn đã nhắn tin! QTV đã tiếp nhận yêu cầu và sẽ phản hồi sớm nhất qua hộp thư này hoặc email tài khoản của bạn.',
      createdAt: new Date(now + 1).toISOString(),
    };
    const next = [...readMessages(), userMessage, replyMessage];
    writeMessages(next);
    return { userMessage, replyMessage };
  },

  async submitFeedback(
    payload: SupportTicketPayload,
  ): Promise<{ ticketId: string; submittedAt: string; syncedToServer: boolean }> {
    if (getStoredSession()?.accessToken) {
      try {
        const created = await supportApi.createTicket(payload);
        try {
          const raw = window.localStorage.getItem(SUPPORT_TICKETS_KEY);
          const list = raw ? (JSON.parse(raw) as unknown[]) : [];
          list.unshift(created);
          window.localStorage.setItem(SUPPORT_TICKETS_KEY, JSON.stringify(list.slice(0, 30)));
        } catch {
          // Ignore storage quota errors
        }
        return {
          ticketId: created.ticketId,
          submittedAt: created.submittedAt,
          syncedToServer: true,
        };
      } catch {
        // Fallback sang lưu cục bộ nếu tạm mất mạng
      }
    }

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
    return { ticketId, submittedAt, syncedToServer: false };
  },

  clear(): void {
    try {
      window.localStorage.removeItem(SUPPORT_MESSAGES_KEY);
      window.localStorage.removeItem(SUPPORT_TICKETS_KEY);
      window.dispatchEvent(new CustomEvent(SUPPORT_EVENT));
    } catch {
      // Ignore storage quota errors
    }
  },
};
