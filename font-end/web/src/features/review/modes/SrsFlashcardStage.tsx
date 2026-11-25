import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { AudioPlayerControls } from '@/components/common/AudioPlayerControls';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { DueReviewItem } from '@/types/models';

export interface SrsFlashcardStageProps {
  item: DueReviewItem;
  onRate: (rating: 1 | 2 | 3 | 4) => void;
}

const RATINGS: Array<{ key: 1 | 2 | 3 | 4; label: string; hint: string; style: string }> = [
  { key: 1, label: '1. Quên', hint: 'Về Hộp 1', style: 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100' },
  { key: 2, label: '2. Khó', hint: 'Giữ hộp', style: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100' },
  { key: 3, label: '3. Nhớ tốt', hint: 'Lên hộp', style: 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100' },
  { key: 4, label: '4. Rất dễ', hint: 'Lên nhanh', style: 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' },
];

export function SrsFlashcardStage({ item, onRate }: SrsFlashcardStageProps) {
  const [flipped, setFlipped] = useState(false);

  useKeyboardShortcuts({
    onSpace: () => setFlipped((prev) => !prev),
    onDigit: (digit) => {
      if (flipped) {
        onRate(digit);
        setFlipped(false);
      }
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
        <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-indigo-700">
          Thẻ ghi nhớ • Hộp {item.leitnerBox}
        </span>
        <span>Phím Space để lật thẻ • Phím 1–4 để đánh giá</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 text-center">
        <span className="inline-block rounded-md bg-white px-2.5 py-0.5 text-xs font-bold text-slate-600">
          {item.cefrLevel} • {item.partOfSpeech}
        </span>
        <h3 className="mt-3 font-heading text-3xl font-extrabold text-slate-900 sm:text-4xl">
          {item.word}
        </h3>
        <p className="mt-1 font-mono text-sm text-slate-500">{item.phonetic}</p>

        <AudioPlayerControls
          word={item.word}
          audioUrl={item.audioUrl}
          align="center"
          className="mt-4"
        />

        {flipped ? (
          <div className="mt-6 rounded-xl border border-indigo-100 bg-white p-4 text-left">
            <p className="font-heading text-lg font-bold text-indigo-900">{item.vietnameseMeaning}</p>
            <p className="mt-2 text-sm text-slate-700">{item.exampleEn}</p>
            <p className="mt-1 text-xs text-slate-500">{item.exampleVi}</p>
          </div>
        ) : (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Lật thẻ xem nghĩa</span>
            </button>
          </div>
        )}
      </div>

      {flipped && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {RATINGS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => {
                onRate(r.key);
                setFlipped(false);
              }}
              className={`rounded-xl border px-3 py-3 text-center transition ${r.style}`}
            >
              <strong className="block text-sm font-bold">{r.label}</strong>
              <span className="mt-0.5 block text-[11px] opacity-80">{r.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
