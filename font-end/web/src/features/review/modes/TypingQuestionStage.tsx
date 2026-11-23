import { useState } from 'react';
import { Lightbulb } from 'lucide-react';
import type { QuizQuestion } from '@/types/models';

export interface TypingQuestionStageProps {
  question: QuizQuestion;
  value: string;
  onChange: (value: string) => void;
  onEnterNext?: () => void;
}

export function TypingQuestionStage({
  question,
  value,
  onChange,
  onEnterNext,
}: TypingQuestionStageProps) {
  const [showPhoneticHint, setShowPhoneticHint] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
        <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-indigo-700">Gõ từ tiếng Anh</span>
        {question.prompt.partOfSpeech && (
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">
            Loại từ: {question.prompt.partOfSpeech}
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Nghĩa tiếng Việt</p>
        <p className="mt-1 font-heading text-2xl font-extrabold text-slate-900">
          {question.prompt.vietnameseMeaning || 'Điền từ còn thiếu vào chỗ trống'}
        </p>

        {question.prompt.clozeExampleEn && (
          <p className="mt-3 rounded-xl bg-white p-3 text-sm font-medium text-slate-700">
            {question.prompt.clozeExampleEn}
          </p>
        )}

        {question.prompt.phonetic && (
          <div className="mt-3">
            {showPhoneticHint ? (
              <p className="font-mono text-xs font-semibold text-indigo-700">
                Gợi ý phiên âm: {question.prompt.phonetic}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setShowPhoneticHint(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 hover:underline"
              >
                <Lightbulb className="h-3.5 w-3.5" />
                <span>Xem gợi ý phiên âm</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="review-typing-input" className="mb-1.5 block text-xs font-bold text-slate-700">
          Nhập từ tiếng Anh
        </label>
        <input
          id="review-typing-input"
          type="text"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnterNext) {
              e.preventDefault();
              onEnterNext();
            }
          }}
          placeholder="Nhập chính xác từ tiếng Anh..."
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>
    </div>
  );
}
