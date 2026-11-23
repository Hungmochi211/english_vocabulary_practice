import type { SavedWordRecord, VocabularyItem } from '@/types/models';

export const SAVED_WORDS_STORAGE_KEY = 'lexitag:v1:saved-words';
export const SAVED_WORDS_EVENT = 'lexitag:saved-words-changed';

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

  toggle(word: VocabularyItem): { saved: boolean; items: SavedWordRecord[] } {
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
    return { saved: !exists, items: next };
  },

  clear(): void {
    writeStorage([]);
  },
};
