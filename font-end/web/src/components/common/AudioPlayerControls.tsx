import { useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { useVocabularyAudio, type AccentCode } from '@/hooks/useVocabularyAudio';

const ACCENT_STORAGE_KEY = 'lexitag:v1:accent';
const ACCENT_EVENT = 'lexitag:accent-changed';

function readStoredAccent(): AccentCode {
  try {
    const saved = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    if (saved === 'en-US' || saved === 'en-GB') return saved;
  } catch {
    // Ignore storage errors
  }
  return 'en-US';
}

function writeStoredAccent(accent: AccentCode): void {
  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // Ignore storage errors
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ACCENT_EVENT, { detail: accent }));
  }
}

export interface AudioPlayerControlsProps {
  word: string;
  audioUrl?: string | null;
  align?: 'left' | 'center';
  prominent?: boolean;
  className?: string;
}

export function AudioPlayerControls({
  word,
  audioUrl,
  align = 'left',
  prominent = false,
  className = '',
}: AudioPlayerControlsProps) {
  const { play } = useVocabularyAudio();
  const [accent, setAccent] = useState<AccentCode>(() => readStoredAccent());

  useEffect(() => {
    const sync = () => setAccent(readStoredAccent());
    window.addEventListener(ACCENT_EVENT, sync);
    return () => window.removeEventListener(ACCENT_EVENT, sync);
  }, []);

  function selectAccent(next: AccentCode) {
    setAccent(next);
    writeStoredAccent(next);
  }

  const alignClass = align === 'center' ? 'justify-center' : 'justify-start';
  const primaryBtnClass = prominent
    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
    : 'border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${alignClass} ${className}`.trim()}>
      <div
        role="group"
        aria-label="Chọn giọng đọc"
        className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5"
      >
        <button
          type="button"
          onClick={() => selectAccent('en-US')}
          aria-pressed={accent === 'en-US'}
          title="Giọng Mỹ (US)"
          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition ${
            accent === 'en-US'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          US
        </button>
        <button
          type="button"
          onClick={() => selectAccent('en-GB')}
          aria-pressed={accent === 'en-GB'}
          title="Giọng Anh (UK)"
          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-extrabold transition ${
            accent === 'en-GB'
              ? 'bg-slate-900 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          UK
        </button>
      </div>

      <button
        type="button"
        onClick={() => void play({ word, audioUrl, rate: 1, accent })}
        className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${primaryBtnClass}`}
      >
        <Volume2 className="h-4 w-4" />
        <span>Nghe chuẩn 1.0×</span>
      </button>

      <button
        type="button"
        onClick={() => void play({ word, audioUrl, rate: 0.7, accent })}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
      >
        <Volume2 className="h-4 w-4" />
        <span>Nghe chậm 0.7×</span>
      </button>
    </div>
  );
}
