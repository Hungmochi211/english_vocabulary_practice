import { describe, expect, it } from 'vitest';
import {
  computeSpellingSuggestions,
  highlightWordInExample,
  matchesVietnameseOrEnglish,
} from '@/utils/fuzzySearch';

describe('T037 - fuzzySearch (Vietnamese diacritics, Levenshtein suggestions & safe highlight)', () => {
  it('matches English words and Vietnamese meanings without diacritics', () => {
    expect(matchesVietnameseOrEnglish('environment', 'môi trường', 'moi truong')).toBe(true);
    expect(matchesVietnameseOrEnglish('peaceful', 'yên bình, thanh bình', 'yen binh')).toBe(true);
    expect(matchesVietnameseOrEnglish('recycle', 'tái chế', 'RECY')).toBe(true);
    expect(matchesVietnameseOrEnglish('coffee', 'cà phê', 'moi truong')).toBe(false);
  });

  it('suggests closest words via Levenshtein distance for misspelled queries (e.g. enviroment -> environment)', () => {
    const dictionary = ['environment', 'peaceful', 'phone', 'recycle', 'coffee', 'morning'];
    const suggestions = computeSpellingSuggestions('enviroment', dictionary, 3);
    expect(suggestions[0]).toBe('environment');
    expect(suggestions.length).toBeGreaterThanOrEqual(1);

    const typo2 = computeSpellingSuggestions('recyle', dictionary, 3);
    expect(typo2[0]).toBe('recycle');
  });

  it('splits example sentence into safe tokens with target word marked', () => {
    const parts = highlightWordInExample(
      'Everyone should help protect the environment today.',
      'environment',
    );
    const highlighted = parts.filter((p) => p.highlight);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].text.toLowerCase()).toBe('environment');
    expect(parts.map((p) => p.text).join('')).toBe(
      'Everyone should help protect the environment today.',
    );
  });
});
