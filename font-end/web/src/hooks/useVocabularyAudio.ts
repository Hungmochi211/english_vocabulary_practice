import { useCallback, useRef, useState } from 'react';

export type AccentCode = 'en-US' | 'en-GB';

export interface PlayAudioOptions {
  word: string;
  audioUrl?: string | null;
  rate?: 1 | 0.7;
  accent?: AccentCode;
}

export function useVocabularyAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speakFallback = useCallback((word: string, rate: number, accent: AccentCode): boolean => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setError('Trình duyệt hiện tại không hỗ trợ phát âm tự động.');
      setIsPlaying(false);
      return false;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = accent;
      utterance.rate = rate;
      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      setError('Không thể phát âm thanh lúc này.');
      setIsPlaying(false);
      return false;
    }
  }, []);

  const play = useCallback(
    async ({ word, audioUrl, rate = 1, accent = 'en-US' }: PlayAudioOptions): Promise<void> => {
      setError(null);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      if (audioUrl && /^https?:\/\//i.test(audioUrl)) {
        try {
          const audio = new Audio(audioUrl);
          audio.playbackRate = rate;
          audioRef.current = audio;
          setIsPlaying(true);
          audio.onended = () => setIsPlaying(false);
          audio.onerror = () => {
            speakFallback(word, rate, accent);
          };
          await audio.play();
          return;
        } catch {
          speakFallback(word, rate, accent);
          return;
        }
      }

      speakFallback(word, rate, accent);
    },
    [speakFallback],
  );

  return { play, isPlaying, error };
}
