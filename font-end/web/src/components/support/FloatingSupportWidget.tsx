import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Headphones,
  MessageCircle,
  MessageSquareWarning,
  Send,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/app/AuthProvider';
import { OPEN_SUPPORT_WIDGET_EVENT } from '@/components/layout/AccountMenu';
import { SUPPORT_EVENT, supportAdapter } from '@/services/adapters/support.adapter';
import { notificationsAdapter } from '@/services/adapters/notifications.adapter';
import { useToast } from '@/components/common/CommonUi';
import { CustomSelect } from '@/components/common/CustomSelect';
import type { SupportMessage } from '@/types/models';

type SupportView = 'menu' | 'chat' | 'feedback' | 'courses' | 'community';

export function FloatingSupportWidget() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SupportView>('menu');

  useEffect(() => {
    const handleExternalOpen = () => {
      setOpen(true);
      setView('menu');
    };
    window.addEventListener(OPEN_SUPPORT_WIDGET_EVENT, handleExternalOpen);
    return () => window.removeEventListener(OPEN_SUPPORT_WIDGET_EVENT, handleExternalOpen);
  }, []);

  const [messages, setMessages] = useState<SupportMessage[]>(() => supportAdapter.listMessages());
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    const sync = () => setMessages(supportAdapter.listMessages());
    window.addEventListener(SUPPORT_EVENT, sync);
    return () => window.removeEventListener(SUPPORT_EVENT, sync);
  }, []);

  useEffect(() => {
    if (open) {
      void supportAdapter.syncMessagesFromServer();
    }
  }, [open, view]);

  const [category, setCategory] = useState('Góp ý tính năng');
  const [detail, setDetail] = useState('');
  const [ticketConfirmation, setTicketConfirmation] = useState<string | null>(null);

  async function handleSendChat(e: FormEvent) {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');
    await supportAdapter.sendMessage(text);
    setMessages(supportAdapter.listMessages());
  }

  async function handleSubmitFeedback(e: FormEvent) {
    e.preventDefault();
    if (!detail.trim()) return;
    const ticket = await supportAdapter.submitFeedback({
      category,
      email: user?.email ?? 'learner@lexitag.vn',
      detail: detail.trim(),
    });
    if (ticket.syncedToServer) {
      await notificationsAdapter.syncFromServer();
    } else {
      notificationsAdapter.push({
        title: `Đã tiếp nhận góp ý (${ticket.ticketId})`,
        body: `Cảm ơn bạn đã gửi "${category}". Đội ngũ QTV sẽ xem xét sớm nhất.`,
        icon: 'message',
        tone: 'purple',
        targetRoute: '/',
      });
    }
    setTicketConfirmation(`Đã tiếp nhận góp ý — Mã phiếu ${ticket.ticketId}.`);
    setDetail('');
    showToast(`Đã gửi góp ý thành công (${ticket.ticketId})`, 'success');
  }

  return (
    <div className="fixed right-4 bottom-4 z-40">
      {open && (
        <div
          role="dialog"
          aria-label="Hỗ trợ Quản trị viên"
          className="mb-3 flex w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-96"
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3.5 text-white">
            <div className="flex items-center gap-2">
              {view !== 'menu' && (
                <button
                  type="button"
                  aria-label="Quay lại menu hỗ trợ"
                  onClick={() => {
                    setView('menu');
                    setTicketConfirmation(null);
                  }}
                  className="rounded-lg p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-300">
                  HỖ TRỢ QTV
                </p>
                <h2 className="font-heading text-sm font-extrabold">Bạn cần hỗ trợ gì?</h2>
              </div>
            </div>
            <button
              type="button"
              aria-label="Đóng hộp hỗ trợ"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-96 overflow-y-auto p-4">
            {view === 'menu' && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setView('chat')}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/50"
                >
                  <MessageCircle className="h-5 w-5 shrink-0 text-indigo-600" />
                  <div>
                    <strong className="block text-xs font-bold text-slate-900">
                      Chat trực tiếp QTV
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Giải đáp nhanh về tài khoản & học tập
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setView('feedback')}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-amber-300 hover:bg-amber-50/50"
                >
                  <MessageSquareWarning className="h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <strong className="block text-xs font-bold text-slate-900">
                      Góp ý / Báo lỗi
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Gửi đề xuất cải tiến hoặc báo lỗi hiển thị
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setView('courses')}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50"
                >
                  <BookOpen className="h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <strong className="block text-xs font-bold text-slate-900">
                      Tư vấn khóa học
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Gợi ý lộ trình A1–B2 phù hợp mục tiêu
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setView('community')}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-left transition hover:border-sky-300 hover:bg-sky-50/50"
                >
                  <Users className="h-5 w-5 shrink-0 text-sky-600" />
                  <div>
                    <strong className="block text-xs font-bold text-slate-900">
                      Cộng đồng học tập
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Kết nối nhóm học Oxford 3000 & thi đua tuần
                    </span>
                  </div>
                </button>
              </div>
            )}

            {view === 'chat' && (
              <div className="space-y-3">
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        m.sender === 'me'
                          ? 'ml-8 bg-slate-900 text-white'
                          : 'mr-8 border border-slate-200 bg-slate-50 text-slate-800'
                      }`}
                    >
                      {m.text}
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendChat} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    aria-label="Nhắn tin cho QTV"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Nhập tin nhắn..."
                    className="w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    aria-label="Gửi tin nhắn hỗ trợ"
                    className="rounded-xl bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            )}

            {view === 'feedback' && (
              <form onSubmit={handleSubmitFeedback} className="space-y-3">
                {ticketConfirmation && (
                  <p
                    role="status"
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"
                  >
                    {ticketConfirmation}
                  </p>
                )}

                <div>
                  <label htmlFor="support-category" className="mb-1 block text-xs font-bold text-slate-700">
                    Danh mục
                  </label>
                  <CustomSelect
                    id="support-category"
                    ariaLabel="Danh mục góp ý"
                    value={category}
                    onChange={(val) => setCategory(val)}
                    options={[
                      { value: 'Góp ý tính năng', label: 'Góp ý tính năng' },
                      { value: 'Báo lỗi kỹ thuật', label: 'Báo lỗi kỹ thuật' },
                      { value: 'Sai sót từ vựng', label: 'Sai sót từ vựng' },
                    ]}
                    fullWidth
                  />
                </div>

                <div>
                  <label htmlFor="support-detail" className="mb-1 block text-xs font-bold text-slate-700">
                    Nội dung chi tiết
                  </label>
                  <textarea
                    id="support-detail"
                    rows={3}
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    required
                    placeholder="Mô tả góp ý hoặc lỗi bạn gặp phải..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Gửi góp ý
                </button>
              </form>
            )}

            {view === 'courses' && (
              <div className="space-y-3 text-xs text-slate-600">
                <p className="font-bold text-slate-900">Lộ trình đề xuất theo mục tiêu trình độ:</p>
                <ul className="list-disc space-y-1.5 pl-4">
                  <li>
                    <strong>A1–A2:</strong> 15 từ/ngày, tập trung Bước 1 Flashcard & Trắc nghiệm.
                  </li>
                  <li>
                    <strong>B1–B2:</strong> 20 từ/ngày, ưu tiên Gõ từ & Nghe chép chính tả.
                  </li>
                </ul>
                <Link
                  to="/courses"
                  onClick={() => setOpen(false)}
                  className="inline-flex rounded-xl bg-indigo-600 px-3.5 py-2 font-bold text-white hover:bg-indigo-700"
                >
                  Xem Lộ trình Khóa học
                </Link>
              </div>
            )}

            {view === 'community' && (
              <div className="space-y-3 text-xs text-slate-600">
                <p className="font-bold text-slate-900">Cộng đồng học tập LexiTag</p>
                <p>
                  Tham gia thi đua XP hằng tuần cùng nhóm học viên để duy trì chuỗi Streak và chia sẻ mẹo ghi nhớ Oxford 3000.
                </p>
                <Link
                  to="/"
                  onClick={() => setOpen(false)}
                  className="inline-flex rounded-xl bg-slate-900 px-3.5 py-2 font-bold text-white hover:bg-slate-800"
                >
                  Xem Bảng xếp hạng Tuần
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-xs font-extrabold text-white shadow-lg transition hover:bg-slate-800"
      >
        <Headphones className="h-4 w-4 text-indigo-300" />
        <span>HỖ TRỢ</span>
      </button>
    </div>
  );
}