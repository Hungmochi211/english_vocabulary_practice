import { httpClient } from '@/services/api/httpClient';
import type {
  AdminSupportThread,
  PaginatedData,
  SupportMessage,
  SupportTicketItem,
} from '@/types/models';

export interface CreateSupportTicketPayload {
  category: string;
  email: string;
  detail: string;
}

export const supportApi = {
  async listMessages(): Promise<SupportMessage[]> {
    const raw = await httpClient.get<SupportMessage[]>('/support/messages');
    return Array.isArray(raw) ? raw : [];
  },

  sendMessage(
    text: string,
  ): Promise<{ userMessage: SupportMessage; replyMessage: SupportMessage }> {
    return httpClient.post<{ userMessage: SupportMessage; replyMessage: SupportMessage }>(
      '/support/messages',
      { text },
    );
  },

  async listTickets(): Promise<SupportTicketItem[]> {
    const raw = await httpClient.get<SupportTicketItem[]>('/support/tickets');
    return Array.isArray(raw) ? raw : [];
  },

  createTicket(payload: CreateSupportTicketPayload): Promise<SupportTicketItem> {
    return httpClient.post<SupportTicketItem>('/support/tickets', payload);
  },

  async listAdminThreads(): Promise<AdminSupportThread[]> {
    const raw = await httpClient.get<AdminSupportThread[]>('/admin/support/threads');
    return Array.isArray(raw) ? raw : [];
  },

  async getAdminThreadMessages(userId: number): Promise<SupportMessage[]> {
    const raw = await httpClient.get<SupportMessage[]>(
      `/admin/support/threads/${userId}/messages`,
    );
    return Array.isArray(raw) ? raw : [];
  },

  replyAdminThread(userId: number, text: string): Promise<SupportMessage> {
    return httpClient.post<SupportMessage>(`/admin/support/threads/${userId}/messages`, { text });
  },

  async listAdminTickets(params?: {
    status?: 'open' | 'resolved' | '';
    page?: number;
    limit?: number;
  }): Promise<PaginatedData<SupportTicketItem>> {
    const query: Record<string, string | number> = {
      page: params?.page ?? 1,
      limit: params?.limit ?? 20,
    };
    if (params?.status) {
      query.status = params.status;
    }
    const raw = await httpClient.get<PaginatedData<SupportTicketItem>>('/admin/support/tickets', {
      params: query,
    });
    return {
      items: Array.isArray(raw?.items) ? raw.items : [],
      page: raw?.page ?? 1,
      limit: raw?.limit ?? 20,
      total: raw?.total ?? 0,
      totalPages: raw?.totalPages ?? 1,
    };
  },

  replyAdminTicket(
    ticketId: number,
    payload: { reply: string; status?: 'open' | 'resolved' },
  ): Promise<SupportTicketItem> {
    return httpClient.patch<SupportTicketItem>(`/admin/support/tickets/${ticketId}/reply`, payload);
  },
};
