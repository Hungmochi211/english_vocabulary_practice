import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { fisherYatesShuffle } from './fisher-yates.util';
import { PracticeMode } from './damerau-levenshtein.util';

export interface VocabCandidate {
  id: number;
  word: string;
  cefrLevel: string;
  partOfSpeech: string;
  topicId: number;
  vietnameseMeaning: string;
  exampleEn?: string;
  exampleVi?: string;
  phonetic?: string;
  audioUrl: string | null;
}

export interface GeneratedQuestionSnapshot {
  vocabularyId: number;
  word: string;
  partOfSpeech: string;
  cefrLevel: string;
  topicId: number;
  practiceMode: PracticeMode;
  prompt: string;
  vietnameseMeaning: string;
  exampleEn: string;
  audioUrl: string | null;
  options: string[] | null;
  correctAnswer: string;
}

export function selectDistractorsFromCandidates(
  target: VocabCandidate,
  candidates: VocabCandidate[],
  count = 3,
): VocabCandidate[] {
  const targetWordLower = target.word.trim().toLowerCase();
  const targetMeaningLower = target.vietnameseMeaning.trim().toLowerCase();

  const seenWords = new Set<string>([targetWordLower]);
  const seenMeanings = new Set<string>([targetMeaningLower]);
  const chosen: VocabCandidate[] = [];

  const tryPickFrom = (list: VocabCandidate[]) => {
    const shuffled = fisherYatesShuffle(list);
    for (const c of shuffled) {
      if (chosen.length >= count) break;
      const w = c.word.trim().toLowerCase();
      const m = c.vietnameseMeaning.trim().toLowerCase();
      if (c.id === target.id || seenWords.has(w) || seenMeanings.has(m)) continue;
      seenWords.add(w);
      seenMeanings.add(m);
      chosen.push(c);
    }
  };

  // Tầng 1: cùng level + cùng topic + cùng part_of_speech
  tryPickFrom(
    candidates.filter(
      (c) =>
        c.cefrLevel === target.cefrLevel &&
        c.topicId === target.topicId &&
        c.partOfSpeech === target.partOfSpeech,
    ),
  );

  // Tầng 2: cùng level + cùng part_of_speech ở chủ đề khác
  if (chosen.length < count) {
    tryPickFrom(
      candidates.filter(
        (c) =>
          c.cefrLevel === target.cefrLevel &&
          c.topicId !== target.topicId &&
          c.partOfSpeech === target.partOfSpeech,
      ),
    );
  }

  // Tầng 3: cùng part_of_speech toàn kho
  if (chosen.length < count) {
    tryPickFrom(candidates.filter((c) => c.partOfSpeech === target.partOfSpeech));
  }

  return chosen;
}

@Injectable()
export class DistractorService {
  constructor(private readonly dataSource: DataSource) {}

  async getDistractorsForVocabulary(target: VocabCandidate): Promise<VocabCandidate[]> {
    // Tầng 1 -> Tầng 2 -> Tầng 3
    const tier1: VocabCandidate[] = await this.dataSource.query(
      `
      SELECT id, word, cefr_level AS "cefrLevel", part_of_speech AS "partOfSpeech",
             topic_id AS "topicId", vietnamese_meaning AS "vietnameseMeaning", audio_url AS "audioUrl"
      FROM vocabularies
      WHERE cefr_level = $1::cefr_level_enum AND part_of_speech = $2 AND topic_id = $3
        AND LOWER(word) <> LOWER($4) AND LOWER(vietnamese_meaning) <> LOWER($5)
      LIMIT 50;
      `,
      [target.cefrLevel, target.partOfSpeech, target.topicId, target.word, target.vietnameseMeaning],
    );

    let picked = selectDistractorsFromCandidates(target, tier1, 3);
    if (picked.length >= 3) return picked;

    const tier2: VocabCandidate[] = await this.dataSource.query(
      `
      SELECT id, word, cefr_level AS "cefrLevel", part_of_speech AS "partOfSpeech",
             topic_id AS "topicId", vietnamese_meaning AS "vietnameseMeaning", audio_url AS "audioUrl"
      FROM vocabularies
      WHERE cefr_level = $1::cefr_level_enum AND part_of_speech = $2 AND topic_id <> $3
        AND LOWER(word) <> LOWER($4) AND LOWER(vietnamese_meaning) <> LOWER($5)
      LIMIT 50;
      `,
      [target.cefrLevel, target.partOfSpeech, target.topicId, target.word, target.vietnameseMeaning],
    );

    picked = selectDistractorsFromCandidates(target, [...tier1, ...tier2], 3);
    if (picked.length >= 3) return picked;

    const tier3: VocabCandidate[] = await this.dataSource.query(
      `
      SELECT id, word, cefr_level AS "cefrLevel", part_of_speech AS "partOfSpeech",
             topic_id AS "topicId", vietnamese_meaning AS "vietnameseMeaning", audio_url AS "audioUrl"
      FROM vocabularies
      WHERE part_of_speech = $1
        AND LOWER(word) <> LOWER($2) AND LOWER(vietnamese_meaning) <> LOWER($3)
      LIMIT 50;
      `,
      [target.partOfSpeech, target.word, target.vietnameseMeaning],
    );

    return selectDistractorsFromCandidates(target, [...tier1, ...tier2, ...tier3], 3);
  }

  async buildQuestionsSnapshot(
    vocabs: VocabCandidate[],
  ): Promise<GeneratedQuestionSnapshot[]> {
    const snapshots: GeneratedQuestionSnapshot[] = [];

    for (let i = 0; i < vocabs.length; i++) {
      const v = vocabs[i];
      const hasAudio = typeof v.audioUrl === 'string' && v.audioUrl.trim().length > 0;

      // Luân phiên 3 chế độ; nếu thiếu audio_url thì tuyệt đối không sinh dictation (FR-006, Edge Case 8)
      let desiredMode: PracticeMode;
      const mod = i % 3;
      if (mod === 0) desiredMode = 'multiple_choice';
      else if (mod === 1) desiredMode = 'typing';
      else desiredMode = hasAudio ? 'dictation' : 'typing';

      let options: string[] | null = null;
      let correctAnswer = v.word;

      if (desiredMode === 'multiple_choice') {
        const distractors = await this.getDistractorsForVocabulary(v);
        if (distractors.length < 3) {
          // Từ loại hiếm < 4 từ khác nghĩa toàn kho -> chuyển sang typing/dictation (FR-006)
          desiredMode = hasAudio ? 'dictation' : 'typing';
        } else {
          options = fisherYatesShuffle([
            v.vietnameseMeaning,
            ...distractors.map((d) => d.vietnameseMeaning),
          ]);
          correctAnswer = v.vietnameseMeaning;
        }
      }

      const maskedExample = v.exampleEn
        ? v.exampleEn.replace(new RegExp(`\\b${v.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '_____')
        : '';

      const prompt =
        desiredMode === 'multiple_choice'
          ? `Chọn nghĩa tiếng Việt đúng của từ "${v.word}" (${v.partOfSpeech})`
          : desiredMode === 'dictation'
            ? `Nghe phát âm và gõ lại từ tiếng Anh (${v.partOfSpeech})`
            : `Gõ từ tiếng Anh có nghĩa "${v.vietnameseMeaning}" (${v.partOfSpeech})${maskedExample ? ` — Ví dụ: ${maskedExample}` : ''}`;

      snapshots.push({
        vocabularyId: v.id,
        word: v.word,
        partOfSpeech: v.partOfSpeech,
        cefrLevel: v.cefrLevel,
        topicId: v.topicId,
        practiceMode: desiredMode,
        prompt,
        vietnameseMeaning: v.vietnameseMeaning,
        exampleEn: v.exampleEn || '',
        audioUrl: v.audioUrl,
        options,
        correctAnswer,
      });
    }

    return snapshots;
  }
}
