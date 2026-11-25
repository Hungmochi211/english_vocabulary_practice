import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVocabularyAudio } from '@/hooks/useVocabularyAudio';

describe('useVocabularyAudio', () => {
  it('falls back to Web Speech API when audioUrl is null', async () => {
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    class FakeUtterance {
      text: string;
      lang = '';
      rate = 1;
      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal('speechSynthesis', { speak: speakMock, cancel: cancelMock });
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);

    const { result } = renderHook(() => useVocabularyAudio());

    await act(async () => {
      await result.current.play({ word: 'peaceful', audioUrl: null, rate: 0.7, accent: 'en-GB' });
    });

    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledTimes(1);
    const spoken = speakMock.mock.calls[0][0] as FakeUtterance;
    expect(spoken.text).toBe('peaceful');
    expect(spoken.rate).toBe(0.5);
    expect(spoken.lang).toBe('en-GB');

    vi.unstubAllGlobals();
  });

  it('prefers local OS en-US voice over remote cloud voice so 0.7x slow playback is honored', async () => {
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    const remoteVoice = { name: 'Google US English', lang: 'en-US', localService: false };
    const localVoice = { name: 'Microsoft Zira', lang: 'en-US', localService: true };
    class FakeUtterance {
      text: string;
      lang = '';
      rate = 1;
      voice: unknown = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    vi.stubGlobal('speechSynthesis', {
      speak: speakMock,
      cancel: cancelMock,
      getVoices: () => [remoteVoice, localVoice],
    });
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);

    const { result } = renderHook(() => useVocabularyAudio());
    await act(async () => {
      await result.current.play({ word: 'environment', audioUrl: null, rate: 0.7, accent: 'en-US' });
    });

    const spoken = speakMock.mock.calls[0][0] as FakeUtterance;
    expect(spoken.voice).toBe(localVoice);
    expect(spoken.rate).toBe(0.5);

    vi.unstubAllGlobals();
  });
});
