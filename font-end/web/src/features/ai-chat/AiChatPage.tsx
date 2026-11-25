import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  MessageSquarePlus,
  Search,
  Send,
  Sparkles,
  Trash2,
  Volume2,
} from 'lucide-react';
import { aiTutorAdapter } from '@/services/adapters/aiTutor.adapter';
import { useVocabularyAudio } from '@/hooks/useVocabularyAudio';
import { Skeleton } from '@/components/common/CommonUi';
import type { AiConversation } from '@/types/models';

const QUICK_PROMPTS = [
  'Cho mình ví dụ và cách dùng từ environment nhé',
  'Giải thích nghĩa và phiên âm của peaceful',
  'Đặt câu ví dụ song ngữ với từ recycle',
  'Gợi ý mẹo nhớ từ vựng Oxford 3000 nhanh',
];

export function AiChatPage() {
  const navigate = useNavigate();
  const { play } = useVocabularyAudio();

  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let mounted = true;
    void aiTutorAdapter.listConversations().then((list) => {
      if (!mounted) return;
      setConversations(list);
      setActiveId(list[0]?.id ?? '');
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const activeConv =
    conversations.find((c) => c.id === activeId) ?? conversations[0] ?? null;

  async function handleNewConversation() {
    const created = await aiTutorAdapter.createConversation();
    setConversations((prev) => [created, ...prev]);
    setActiveId(created.id);
  }

  async function handleDeleteConversation(id: string) {
    await aiTutorAdapter.deleteConversation(id);
    const refreshed = await aiTutorAdapter.listConversations();
    setConversations(refreshed);
    if (activeId === id) {
      setActiveId(refreshed[0]?.id ?? '');
    }
  }

  async function submitPrompt(promptText: string) {
    const clean = promptText.trim();
    if (!clean || !activeConv || sending) return;
    setSending(true);
    setInputText('');
    try {
      const reply = await aiTutorAdapter.sendMessage(activeConv.id, clean);
      setConversations((prev) => [
        reply.conversation,
        ...prev.filter((c) => c.id !== reply.conversation.id),
      ]);
      setActiveId(reply.conversation.id);
    } finally {
      setSending(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submitPrompt(inputText);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-slate-900">
            Trợ lý AI Học Từ Vựng
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Giải thích nghĩa, phiên âm IPA và câu ví dụ song ngữ theo kho từ vựng Oxford 3000.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700 sm:self-auto">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Trợ lý Oxford 3000</span>
        </span>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: Conversation List */}
        <aside className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs lg:col-span-4">
          <button
            type="button"
            onClick={() => void handleNewConversation()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
          >
            <MessageSquarePlus className="h-4 w-4" />
            <span>Hội thoại mới</span>
          </button>

          <div className="mt-3 max-h-[500px] space-y-1.5 overflow-y-auto">
            {loading ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeConv?.id;
                return (
                  <div
                    key={conv.id}
                    data-testid="ai-conversation-item"
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition ${
                      isActive
                        ? 'border-indigo-300 bg-indigo-50/70'
                        : 'border-slate-100 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveId(conv.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-xs font-bold text-slate-900">{conv.title}</p>
                      <p className="text-[11px] text-slate-500">
                        {conv.messages.length} tin nhắn
                      </p>
                    </button>
                    <button
                      type="button"
                      aria-label={`Xóa hội thoại ${conv.title}`}
                      onClick={() => void handleDeleteConversation(conv.id)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right: Chat Pane */}
        <section className="flex min-h-[520px] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xs lg:col-span-8">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {activeConv?.messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-800'
                    }`}
                  >
                    {!isUser && (
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                        <Bot className="h-3.5 w-3.5" />
                        <span>Trợ lý AI LexiTag</span>
                      </div>
                    )}
                    <p className="whitespace-pre-line">{msg.content}</p>

                    {!isUser && msg.detectedWords && msg.detectedWords.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200/80 pt-2.5">
                        {msg.detectedWords.map((word) => (
                          <div key={word} className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void play({ word, rate: 1, accent: 'en-US' })}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50"
                            >
                              <Volume2 className="h-3.5 w-3.5" />
                              <span>Nghe "{word}"</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                navigate(`/dictionary?q=${encodeURIComponent(word)}`)
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                            >
                              <Search className="h-3.5 w-3.5" />
                              <span>Mở "{word}" trong Tra từ</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Prompt Chips */}
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-4 py-2.5">
            {QUICK_PROMPTS.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={sending}
                onClick={() => void submitPrompt(chip)}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <form onSubmit={handleFormSubmit} className="flex items-center gap-2 border-t border-slate-100 p-4">
            <input
              type="text"
              aria-label="Nhập câu hỏi cho Trợ lý AI"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Hỏi nghĩa, cách dùng, câu ví dụ từ Oxford 3000..."
              className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={sending || !inputText.trim()}
              aria-label="Gửi câu hỏi"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span>Gửi</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
