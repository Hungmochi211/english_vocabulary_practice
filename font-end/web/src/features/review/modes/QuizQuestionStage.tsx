import { Volume2 } from 'lucide-react';
import { useVocabularyAudio } from '@/hooks/useVocabularyAudio';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { QuizQuestion } from '@/types/models';

export interface QuizQuestionStageProps {
  question: QuizQuestion;
  selectedAnswer: string;
  onSelect: (answer: string) => void;
  onEnterNext?: () => void;
}

export function QuizQuestionStage({
  question,
  selectedAnswer,
  onSelect,
  onEnterNext,
}: QuizQuestionStageProps) {
  const { play } = useVocabularyAudio();
  const options = question.prompt.options ?? [];

  useKeyboardShortcuts({
    onDigit: (digit) => {
      const idx = digit - 1;
      if (options[idx]) {
        onSelect(options[idx]);
      }
    },
    onEnter: () => {
      if (selectedAnswer && onEnterNext) {
        onEnterNext();
      }
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-slate-500">
        <span className="rounded-md bg-indigo-50 px-2.5 py-1 text-indigo-700">
          Trắc nghiệm 4 đáp án
        </span>
        <span>Phím 1–4 để chọn nhanh • Enter để tiếp tục</span>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 text-center">
        {question.prompt.word ? (
          <>
            <h3 className="font-heading text-3xl font-extrabold text-slate-900">
              {question.prompt.word}
            </h3>
            {question.prompt.phonetic && (
              <p className="mt-1 font-mono text-sm text-slate-500">{question.prompt.phonetic}</p>
            )}
            <div className="mt-3 flex justify-center gap-2">
              <button
                type="button"
                onClick={() =>
                  void play({
                    word: question.prompt.word ?? '',
                    audioUrl: question.prompt.audioUrl,
                    rate: 1,
                    accent: 'en-US',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>Nghe 1.0×</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  void play({
                    word: question.prompt.word ?? '',
                    audioUrl: question.prompt.audioUrl,
                    rate: 0.7,
                    accent: 'en-GB',
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>Chậm 0.7×</span>
              </button>
            </div>
          </>
        ) : (
          <p className="font-heading text-xl font-extrabold text-slate-900">
            {question.prompt.vietnameseMeaning}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((opt, idx) => {
          const active = selectedAnswer === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              aria-pressed={active}
              className={`flex items-start gap-2.5 rounded-xl border px-4 py-3.5 text-left text-sm font-semibold transition ${
                active
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-200'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 font-mono text-xs font-bold text-slate-600">
                {idx + 1}
              </span>
              <span>{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
