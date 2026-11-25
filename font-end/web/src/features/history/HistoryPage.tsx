import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  History,
  RefreshCw,
  Search,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { HISTORY_EVENT, historyAdapter } from '@/services/adapters/history.adapter';
import { EmptyState } from '@/components/common/CommonUi';
import { CustomSelect } from '@/components/common/CustomSelect';
import { formatXp } from '@/utils/formatters';
import type { ActivityHistoryItem } from '@/types/models';

const TYPE_LABELS: Record<ActivityHistoryItem['type'], string> = {
  study: 'Học thẻ Bước 1',
  pronunciation: 'Phát âm',
  srs: 'Thẻ ghi nhớ',
  quiz: 'Trắc nghiệm',
  typing: 'Gõ từ',
  dictation: 'Nghe chép',
};

const TYPE_OPTIONS: Array<{ value: '' | ActivityHistoryItem['type']; label: string }> = [
  { value: '', label: 'Tất cả loại' },
  { value: 'study', label: 'Học thẻ Bước 1' },
  { value: 'pronunciation', label: 'Phát âm' },
  { value: 'srs', label: 'Thẻ ghi nhớ' },
  { value: 'quiz', label: 'Trắc nghiệm' },
  { value: 'typing', label: 'Gõ từ' },
  { value: 'dictation', label: 'Nghe chép' },
];

export function HistoryPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ActivityHistoryItem[]>(() => historyAdapter.list());
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | ActivityHistoryItem['type']>('');
  const [resultFilter, setResultFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [selectedItem, setSelectedItem] = useState<ActivityHistoryItem | null>(null);

  useEffect(() => {
    const sync = () => setItems(historyAdapter.list());
    window.addEventListener(HISTORY_EVENT, sync);
    return () => window.removeEventListener(HISTORY_EVENT, sync);
  }, []);

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter && item.type !== typeFilter) return false;
      if (resultFilter === 'pass' && item.accuracy < 80) return false;
      if (resultFilter === 'fail' && item.accuracy >= 80) return false;
      if (q && !item.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, resultFilter, searchText, typeFilter]);

  const kpis = useMemo(() => {
    const totalSessions = items.length;
    const avgAccuracy =
      totalSessions > 0
        ? Math.round(items.reduce((acc, item) => acc + item.accuracy, 0) / totalSessions)
        : 0;
    const totalXp = items.reduce((acc, item) => acc + item.xp, 0);
    const passedCount = items.filter((item) => item.accuracy >= 80).length;
    return { totalSessions, avgAccuracy, totalXp, passedCount };
  }, [items]);

  function launchCustomPractice(item: ActivityHistoryItem, onlyWrong: boolean) {
    const targetWords = onlyWrong ? item.words.filter((w) => !w.ok) : item.words;
    if (targetWords.length === 0) return;
    navigate('/review', {
      state: {
        customPractice: {
          title: onlyWrong ? `Ôn các từ sai — ${item.title}` : `Ôn lại phiên — ${item.title}`,
          words: targetWords.map((w, idx) => ({
            vocabularyId: w.vocabularyId ?? 9000 + idx,
            word: w.word,
            phonetic: w.phonetic ?? '',
            vietnameseMeaning: w.meaning ?? `Gõ lại từ "${w.word}"`,
          })),
        },
      },
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs sm:flex-row sm:items-center">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-slate-900">
            Lịch sử Học & Ôn tập
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Theo dõi toàn bộ các phiên học 2 bước, phiên ôn tập và bấm vào từng phiên để xem từ đúng/sai hoặc ôn lại nhanh.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-indigo-100 bg-indigo-50 px-3.5 py-1.5 text-xs font-bold text-indigo-700 sm:self-auto">
          <History className="h-4 w-4" />
          <span>{items.length} phiên đã ghi nhận</span>
        </span>
      </header>

      {/* 4 KPI Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-bold uppercase text-slate-400">Tổng số phiên</p>
          <p className="mt-2 font-heading text-2xl font-extrabold text-slate-900">
            {kpis.totalSessions}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-bold uppercase text-slate-400">Độ chính xác TB</p>
          <p className="mt-2 font-heading text-2xl font-extrabold text-indigo-700">
            {kpis.avgAccuracy}%
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-bold uppercase text-slate-400">Phiên đạt ≥ 80%</p>
          <p className="mt-2 font-heading text-2xl font-extrabold text-emerald-700">
            {kpis.passedCount}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-bold uppercase text-slate-400">Tổng XP lịch sử</p>
          <p className="mt-2 font-heading text-2xl font-extrabold text-amber-700">
            {formatXp(kpis.totalXp)} XP
          </p>
        </article>
      </section>

      {/* Filters */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            type="search"
            aria-label="Tìm phiên trong lịch sử"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Tìm theo tên bài học hoặc phiên ôn..."
            className="w-full min-w-0 bg-transparent text-xs text-slate-800 outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CustomSelect
            ariaLabel="Lọc loại hoạt động"
            value={typeFilter}
            onChange={(val) => setTypeFilter(val as '' | ActivityHistoryItem['type'])}
            options={TYPE_OPTIONS}
            align="right"
          />

          <CustomSelect
            ariaLabel="Lọc kết quả"
            value={resultFilter}
            onChange={(val) => setResultFilter(val as 'all' | 'pass' | 'fail')}
            options={[
              { value: 'all', label: 'Mọi kết quả' },
              { value: 'pass', label: 'Đạt (≥ 80%)' },
              { value: 'fail', label: 'Cần cải thiện (< 80%)' },
            ]}
            align="right"
          />
        </div>
      </section>

      {/* Fixed-height 10-row scrollable list (.hs-list) */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Chưa có phiên hoạt động nào"
              description="Hoàn thành Bước 1, Bước 2 hoặc một phiên ôn tập để lịch sử học tập tự động cập nhật tại đây."
            />
          </div>
        ) : (
          <div
            data-testid="history-scroll-list"
            className="hs-list max-h-[640px] divide-y divide-slate-100 overflow-y-auto"
          >
            {filtered.map((item) => {
              const passed = item.accuracy >= 80;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItem(item)}
                  className="flex w-full flex-col justify-between gap-2 px-5 py-3.5 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                        {TYPE_LABELS[item.type]}
                      </span>
                      <strong className="truncate font-heading text-sm font-bold text-slate-900">
                        {item.title}
                      </strong>
                    </div>
                    <p className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span>
                        Đúng {item.correct}/{item.total} từ
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {item.duration}
                      </span>
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        passed
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      {item.accuracy}%
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700">
                      <Trophy className="h-3.5 w-3.5 text-amber-500" />+{item.xp} XP
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Detail Drawer / Modal */}
      {selectedItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết phiên hoạt động"
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedItem(null);
          }}
        >
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">
                  Chi tiết phiên hoạt động
                </p>
                <h2 className="mt-1 font-heading text-lg font-extrabold text-slate-900">
                  {selectedItem.title}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {TYPE_LABELS[selectedItem.type]} • {selectedItem.accuracy}% • +{selectedItem.xp} XP
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng ngăn kéo chi tiết"
                onClick={() => setSelectedItem(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {selectedItem.words.length === 0 ? (
                <p className="text-xs text-slate-500">Không có chi tiết từng từ cho phiên này.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {selectedItem.words.map((word, idx) => (
                    <li
                      key={`${word.word}-${idx}`}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <strong className="font-heading text-sm font-bold text-slate-900">
                          {word.word}
                        </strong>
                        {word.phonetic && (
                          <span className="ml-2 font-mono text-xs text-slate-400">
                            {word.phonetic}
                          </span>
                        )}
                        {word.meaning && (
                          <p className="text-xs text-slate-600">{word.meaning}</p>
                        )}
                      </div>
                      {word.ok ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Đúng
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                          <XCircle className="h-3.5 w-3.5" />
                          Sai
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-100 p-4">
              {selectedItem.words.some((w) => !w.ok) && (
                <button
                  type="button"
                  onClick={() => launchCustomPractice(selectedItem, true)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-rose-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Ôn các từ sai</span>
                </button>
              )}
              {selectedItem.words.length > 0 && (
                <button
                  type="button"
                  onClick={() => launchCustomPractice(selectedItem, false)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Ôn lại phiên này</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
