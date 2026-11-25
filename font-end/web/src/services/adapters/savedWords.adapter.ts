import { getStoredSession } from '@/services/api/httpClient';
import { vocabularyApi } from '@/services/api/vocabulary.api';
import type { SavedWordRecord, VocabularyItem } from '@/types/models';

export const SAVED_WORDS_STORAGE_KEY = 'lexitag:v1:saved-words';
export const SAVED_WORDS_EVENT = 'lexitag:saved-words-changed';

let mutationSeq = 0;
const inFlightWrites = new Set<Promise<unknown>>();

function trackWrite(promise: Promise<unknown>): void {
  inFlightWrites.add(promise);
  void promise.finally(() => {
    inFlightWrites.delete(promise);
  });
}

function readStorage(): SavedWordRecord[] {
  try {
    const raw = window.localStorage.getItem(SAVED_WORDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedWordRecord[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(items: SavedWordRecord[]): void {
  try {
    window.localStorage.setItem(SAVED_WORDS_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(SAVED_WORDS_EVENT));
  } catch {
    // Ignore private-mode / quota errors safely
  }
}

export const savedWordsAdapter = {
  list(): SavedWordRecord[] {
    return readStorage();
  },

  isSaved(vocabularyId: number): boolean {
    return readStorage().some((item) => item.vocabularyId === vocabularyId);
  },

  async syncFromServer(): Promise<SavedWordRecord[]> {
    if (!getStoredSession()?.accessToken) {
      return readStorage();
    }
    try {
      if (inFlightWrites.size > 0) {
        await Promise.allSettled(Array.from(inFlightWrites));
      }
      const seqAtStart = mutationSeq;
      const serverItems = await vocabularyApi.listSavedWords();
      if (mutationSeq !== seqAtStart) {
        return readStorage();
      }

      const localItems = readStorage();
      if (serverItems.length === 0 && localItems.length > 0) {
        await Promise.allSettled(
          localItems.map((item) => vocabularyApi.saveWord(item.vocabularyId)),
        );
        return localItems;
      }

      writeStorage(serverItems);
      return serverItems;
    } catch {
      return readStorage();
    }
  },

  toggle(word: VocabularyItem): { saved: boolean; items: SavedWordRecord[] } {
    mutationSeq += 1;
    const current = readStorage();
    const exists = current.some((item) => item.vocabularyId === word.id);
    const next = exists
      ? current.filter((item) => item.vocabularyId !== word.id)
      : [
          {
            vocabularyId: word.id,
            word: word.word,
            cefrLevel: word.cefrLevel,
            partOfSpeech: word.partOfSpeech,
            phonetic: word.phonetic,
            vietnameseMeaning: word.vietnameseMeaning,
            savedAt: new Date().toISOString(),
          },
          ...current,
        ];
    writeStorage(next);

    if (getStoredSession()?.accessToken) {
      const req = exists
        ? vocabularyApi.unsaveWord(word.id).catch(() => undefined)
        : vocabularyApi.saveWord(word.id).catch(() => undefined);
      trackWrite(req);
    }

    return { saved: !exists, items: next };
  },

  clear(): void {
    mutationSeq += 1;
    writeStorage([]);
  },
};
