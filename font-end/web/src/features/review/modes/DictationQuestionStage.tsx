import { useState } from 'react';
import { Eye } from 'lucide-react';
import { AudioPlayerControls } from '@/components/common/AudioPlayerControls';
import type { QuizQuestion } from '@/types/models';

export interface DictationQuestionStageProps {
  question: QuizQuestion;
  spokenFallbackText: string;
  value: string;
  onChange: (value: string) => void;
  onEnterNext?: () => void;
}

export function DictationQuestionStage({
  question,
  spokenFallbackText,
  value,
  onChange,
  onEnterNext,
}: DictationQuestionStageProps) {
  const [revealMeaning, setRevealMeaning] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
        <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-indigo-700">
          Nghe chép chính tả
        </span>
        {question.prompt.phonetic && <span className="font-mono">{question.prompt.phonetic}</span>}
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-6 text-center">
        <p className="text-sm font-semibold text-slate-700">
          Nhấn nghe phát âm và chép lại chính xác từ tiếng Anh bạn nghe được
        </p>

        <AudioPlayerControls
          word={spokenFallbackText}
          audioUrl={question.prompt.audioUrl}
          align="center"
          prominent
          className="mt-4"
        />

        {question.prompt.vietnameseMeaning && (
          <div className="mt-4">
            {revealMeaning ? (
              <p className="text-sm font-semibold text-slate-800">
                Nghĩa gợi ý: {question.prompt.vietnameseMeaning}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setRevealMeaning(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-indigo-700"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Hiện gợi ý nghĩa tiếng Việt</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="review-dictation-input" className="mb-1.5 block text-xs font-bold text-slate-700">
          Nhập từ tiếng Anh
        </label>
        <input
          id="review-dictation-input"
          type="text"
          autoComplete="off"
          maxLength={100}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && onEnterNext) {
              e.preventDefault();
              onEnterNext();
            }
          }}
          placeholder="Gõ từ bạn vừa nghe..."
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>
    </div>
  );
}
