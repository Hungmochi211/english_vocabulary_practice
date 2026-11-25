import { useCallback, useEffect, useRef, useState } from 'react';

export type AccentCode = 'en-US' | 'en-GB';

export interface PlayAudioOptions {
  word: string;
  audioUrl?: string | null;
  rate?: 1 | 0.7;
  accent?: AccentCode;
}

function isRemoteOrNeuralVoice(voice: SpeechSynthesisVoice): boolean {
  return !voice.localService || /google|online|natural/i.test(voice.name);
}

function pickMatchingVoice(
  accent: AccentCode,
  cachedVoices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  const liveVoices =
    typeof window !== 'undefined' && window.speechSynthesis?.getVoices
      ? window.speechSynthesis.getVoices()
      : [];
  const voices = liveVoices.length > 0 ? liveVoices : cachedVoices;
  if (!voices || voices.length === 0) return null;

  const target = accent.toLowerCase();
  const exactMatches = voices.filter((v) => v.lang.replace('_', '-').toLowerCase() === target);

  // 1. Prefer native OS local voices (e.g. Microsoft David/Zira/Hazel) which faithfully honor rate < 1
  const nativeLocal = exactMatches.find((v) => !isRemoteOrNeuralVoice(v));
  if (nativeLocal) return nativeLocal;

  // 2. Fallback to any localService exact match
  const anyLocal = exactMatches.find((v) => v.localService);
  if (anyLocal) return anyLocal;

  if (exactMatches[0]) return exactMatches[0];

  const langPrefix = target.split('-')[0];
  const prefixMatches = voices.filter((v) =>
    v.lang.replace('_', '-').toLowerCase().startsWith(langPrefix),
  );
  return (
    prefixMatches.find((v) => !isRemoteOrNeuralVoice(v)) ??
    prefixMatches.find((v) => v.localService) ??
    prefixMatches[0] ??
    null
  );
}

export function useVocabularyAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis?.getVoices) return undefined;
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length > 0) {
        voicesRef.current = list;
      }
    };
    loadVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener?.('voiceschanged', loadVoices);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (typeof window !== 'undefined') {
        window.speechSynthesis?.cancel?.();
      }
    };
  }, []);

  const speakFallback = useCallback((word: string, rate: number, accent: AccentCode): boolean => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setError('Trình duyệt hiện tại không hỗ trợ phát âm tự động.');
      setIsPlaying(false);
      return false;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      const selectedVoice = pickMatchingVoice(accent, voicesRef.current);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang = accent;
      }
      // Windows SAPI5 & Chrome cloud voices compress playback rate near 0.7 on single words;
      // use 0.5 for Web Speech API slow mode so both US and UK voices slow down audibly.
      utterance.rate = rate < 1 ? 0.5 : rate;
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
          audio.defaultPlaybackRate = rate;
          audio.playbackRate = rate;
          audio.onloadedmetadata = () => {
            audio.playbackRate = rate;
          };
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
