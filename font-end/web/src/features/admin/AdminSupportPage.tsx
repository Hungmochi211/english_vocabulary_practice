import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Headphones,
  MessageCircle,
  MessageSquareWarning,
  Send,
} from 'lucide-react';
import { supportApi } from '@/services/api/support.api';
import { ApiError } from '@/services/api/httpClient';
import { EmptyState, ErrorRetryBox, Skeleton, useToast } from '@/components/common/CommonUi';

export function AdminSupportPage() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'threads' | 'tickets'>('threads');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');

  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [ticketReplies, setTicketReplies] = useState<Record<number, string>>({});

  const threadsQuery = useQuery({
    queryKey: ['admin', 'support', 'threads'],
    queryFn: () => supportApi.listAdminThreads(),
  });

  const threads = threadsQuery.data ?? [];

  useEffect(() => {
    if (selectedUserId === null && threads.length > 0) {
      setSelectedUserId(threads[0].userId);
    }
  }, [selectedUserId, threads]);

  const threadMessagesQuery = useQuery({
    queryKey: ['admin', 'support', 'thread-messages', selectedUserId],
    queryFn: () => supportApi.getAdminThreadMessages(selectedUserId!),
    enabled: selectedUserId !== null,
  });

  const ticketsQuery = useQuery({
    queryKey: ['admin', 'support', 'tickets', ticketStatusFilter],
    queryFn: () =>
      supportApi.listAdminTickets({
        status: ticketStatusFilter === 'all' ? '' : ticketStatusFilter,
        page: 1,
        limit: 30,
      }),
  });

  const replyThreadMutation = useMutation({
    mutationFn: ({ userId, text }: { userId: number; text: string }) =>
      supportApi.replyAdminThread(userId, text),
    onSuccess: () => {
      setReplyText('');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'support'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
      showToast('Đã gửi phản hồi trực tiếp cho học viên', 'success');
    },
    onError: (err) => {
      showToast(
        err instanceof ApiError ? err.message : 'Không thể gửi phản hồi lúc này.',
        'error',
      );
    },
  });

  const replyTicketMutation = useMutation({
    mutationFn: ({ ticketId, reply }: { ticketId: number; reply: string }) =>
      supportApi.replyAdminTicket(ticketId, { reply, status: 'resolved' }),
    onSuccess: (updated) => {
      setTicketReplies((prev) => ({ ...prev, [updated.id]: '' }));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'support'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit-logs'] });
      showToast(`Đã phản hồi và đóng phiếu ${updated.ticketId}`, 'success');
    },
    onError: (err) => {
      showToast(
        err instanceof ApiError ? err.message : 'Không thể cập nhật phiếu góp ý.',
        'error',
      );
    },
  });

  function handleSendThreadReply(e: FormEvent) {
    e.preventDefault();
    if (selectedUserId === null || !replyText.trim() || replyThreadMutation.isPending) return;
    replyThreadMutation.mutate({ userId: selectedUserId, text: replyText.trim() });
  }

  const selectedThread = threads.find((t) => t.userId === selectedUserId) ?? null;
  const tickets = ticketsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:flex-row sm:items-center">
        <div>
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Về Tổng quan Quản trị</span>
          </Link>
          <h1 className="mt-1 flex items-center gap-2 font-heading text-2xl font-extrabold text-slate-900">
            <Headphones className="h-6 w-6 text-indigo-600" />
            <span>Hỗ trợ &amp; Góp ý Học viên</span>
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Phản hồi trực tiếp hội thoại và xử lý phiếu góp ý — tự động đẩy chuông thông báo tới học viên.
          </p>
        </div>

        <Link
          to="/admin/audit-logs"
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 sm:self-auto"
        >
          <ClipboardList className="h-4 w-4" />
          <span>Nhật ký Kiểm toán</span>
        </Link>
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('threads')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            activeTab === 'threads'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          <span>Hội thoại Hỗ trợ ({threads.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tickets')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition ${
            activeTab === 'tickets'
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <MessageSquareWarning className="h-4 w-4" />
          <span>Phiếu Góp ý / Báo lỗi ({ticketsQuery.data?.total ?? 0})</span>
        </button>
      </div>

      {activeTab === 'threads' ? (
        threadsQuery.isError ? (
          <ErrorRetryBox
            message="Không thể tải danh sách hội thoại hỗ trợ."
            onRetry={() => void threadsQuery.refetch()}
          />
        ) : threadsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl lg:col-span-2" />
          </div>
        ) : threads.length === 0 ? (
          <EmptyState
            title="Chưa có hội thoại hỗ trợ nào"
            description="Tin nhắn từ học viên qua hộp Chat trực tiếp QTV sẽ xuất hiện tại đây."
          />
        ) : (
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
              {threads.map((thread) => {
                const active = thread.userId === selectedUserId;
                return (
                  <button
                    key={thread.userId}
                    type="button"
                    onClick={() => setSelectedUserId(thread.userId)}
                    className={`w-full p-4 text-left transition ${
                      active ? 'bg-indigo-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="truncate text-sm font-extrabold text-slate-900">
                        {thread.fullName}
                      </strong>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        {thread.messageCount} tin
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-500">{thread.email}</p>
                    <p className="mt-1.5 line-clamp-2 text-xs text-slate-700">{thread.lastMessage}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-2">
              {selectedThread ? (
                <>
                  <div className="border-b border-slate-100 pb-3">
                    <h2 className="font-heading text-base font-extrabold text-slate-900">
                      {selectedThread.fullName}
                    </h2>
                    <p className="text-xs text-slate-500">{selectedThread.email}</p>
                  </div>

                  <div className="my-4 max-h-80 space-y-2.5 overflow-y-auto pr-1">
                    {threadMessagesQuery.isLoading ? (
                      <Skeleton className="h-24 w-full rounded-xl" />
                    ) : (
                      (threadMessagesQuery.data ?? []).map((msg) => {
                        const isLearner = msg.senderRole === 'learner' || msg.sender === 'me';
                        return (
                          <div
                            key={msg.id}
                            className={`rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                              isLearner
                                ? 'mr-10 border border-slate-200 bg-slate-50 text-slate-900'
                                : 'ml-10 bg-indigo-600 text-white'
                            }`}
                          >
                            <span className="mb-0.5 block text-[10px] font-extrabold uppercase opacity-75">
                              {isLearner ? selectedThread.fullName : 'Quản trị viên'}
                            </span>
                            <p>{msg.text}</p>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <form onSubmit={handleSendThreadReply} className="flex gap-2 border-t border-slate-100 pt-3">
                    <input
                      type="text"
                      aria-label="Phản hồi tin nhắn học viên"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Nhập phản hồi gửi tới học viên..."
                      className="w-full min-w-0 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={replyThreadMutation.isPending || !replyText.trim()}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Gửi phản hồi</span>
                    </button>
                  </form>
                </>
              ) : (
                <p className="py-12 text-center text-sm text-slate-500">
                  Chọn một học viên bên trái để xem lịch sử trao đổi.
                </p>
              )}
            </div>
          </section>
        )
      ) : (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: 'all', label: 'Tất cả' },
                { key: 'open', label: 'Đang mở' },
                { key: 'resolved', label: 'Đã xử lý' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setTicketStatusFilter(opt.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  ticketStatusFilter === opt.key
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {ticketsQuery.isError ? (
            <ErrorRetryBox
              message="Không thể tải danh sách phiếu góp ý."
              onRetry={() => void ticketsQuery.refetch()}
            />
          ) : ticketsQuery.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
          ) : tickets.length === 0 ? (
            <EmptyState
              title="Không có phiếu góp ý nào"
              description="Hiện chưa có phiếu góp ý hoặc báo lỗi nào ở trạng thái này."
            />
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => {
                const draft = ticketReplies[ticket.id] ?? '';
                return (
                  <article
                    key={ticket.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-extrabold text-white">
                          {ticket.ticketId}
                        </span>
                        <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                          {ticket.category}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">
                          {ticket.userFullName ? `${ticket.userFullName} • ` : ''}
                          {ticket.email}
                        </span>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                          ticket.status === 'resolved'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {ticket.status === 'resolved' && <CheckCircle2 className="h-3.5 w-3.5" />}
                        <span>{ticket.status === 'resolved' ? 'Đã xử lý' : 'Đang mở'}</span>
                      </span>
                    </div>

                    <p className="mt-3 rounded-xl bg-slate-50 p-3.5 text-sm text-slate-800">
                      {ticket.detail}
                    </p>

                    {ticket.adminReply && (
                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-900">
                        <strong className="block font-extrabold">Phản hồi từ QTV:</strong>
                        <p className="mt-1">{ticket.adminReply}</p>
                      </div>
                    )}

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!draft.trim() || replyTicketMutation.isPending) return;
                        replyTicketMutation.mutate({ ticketId: ticket.id, reply: draft.trim() });
                      }}
                      className="mt-3 flex flex-col gap-2 sm:flex-row"
                    >
                      <input
                        type="text"
                        aria-label={`Nội dung phản hồi phiếu ${ticket.ticketId}`}
                        value={draft}
                        onChange={(e) =>
                          setTicketReplies((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                        }
                        placeholder={
                          ticket.status === 'resolved'
                            ? 'Cập nhật thêm phản hồi cho phiếu này...'
                            : 'Nhập phản hồi xử lý cho học viên...'
                        }
                        className="w-full min-w-0 rounded-xl border border-slate-300 px-3.5 py-2 text-xs outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={replyTicketMutation.isPending || !draft.trim()}
                        className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-slate-800 disabled:opacity-60"
                      >
                        Phản hồi &amp; Đóng phiếu
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
