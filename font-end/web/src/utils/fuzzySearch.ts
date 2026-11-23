import { stripVietnameseDiacritics } from '@/utils/formatters';
import { damerauLevenshteinDistance } from '@/utils/gradingFeedback';

export function matchesVietnameseOrEnglish(
  word: string,
  vietnameseMeaning: string,
  query: string,
): boolean {
  const normalizedQuery = stripVietnameseDiacritics(query.trim());
  if (!normalizedQuery) return true;
  const wordNorm = stripVietnameseDiacritics(word);
  const meaningNorm = stripVietnameseDiacritics(vietnameseMeaning);
  return wordNorm.includes(normalizedQuery) || meaningNorm.includes(normalizedQuery);
}

export function computeSpellingSuggestions(
  query: string,
  candidates: string[],
  maxResults = 4,
): string[] {
  const cleanQuery = query.trim().toLowerCase();
  if (cleanQuery.length < 2) return [];

  const maxDist = cleanQuery.length <= 4 ? 1 : cleanQuery.length <= 7 ? 2 : 3;
  const uniqueCandidates = Array.from(new Set(candidates.map((c) => c.trim()).filter(Boolean)));

  const scored = uniqueCandidates
    .map((candidate) => {
      const lower = candidate.toLowerCase();
      const distance = damerauLevenshteinDistance(cleanQuery, lower);
      const prefixBonus = lower.startsWith(cleanQuery.slice(0, 2)) ? -0.25 : 0;
      return { candidate, distance, score: distance + prefixBonus };
    })
    .filter((entry) => entry.distance > 0 && entry.distance <= maxDist)
    .sort((a, b) => a.score - b.score || a.candidate.localeCompare(b.candidate));

  return scored.slice(0, maxResults).map((entry) => entry.candidate);
}

export interface HighlightToken {
  text: string;
  highlight: boolean;
}

export function highlightWordInExample(sentence: string, word: string): HighlightToken[] {
  const cleanWord = word.trim();
  if (!sentence || !cleanWord) {
    return sentence ? [{ text: sentence, highlight: false }] : [];
  }

  const escaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  return sentence
    .split(regex)
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => ({
      text: chunk,
      highlight: chunk.toLowerCase() === cleanWord.toLowerCase(),
    }));
}
