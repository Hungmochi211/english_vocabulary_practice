import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SearchVocabDto } from '../dto/search-vocab.dto';

export function escapeLikeWildcards(input: string): string {
  return input.replace(/[\\%_]/g, (match) => `\\${match}`);
}

@Injectable()
export class VocabularyService {
  constructor(private readonly dataSource: DataSource) {}

  async searchVocabularies(dto: SearchVocabDto) {
    const normalizedQ = dto.q.trim().toLowerCase();
    const escapedQ = escapeLikeWildcards(normalizedQ);
    const limit = dto.limit ?? 20;

    const rows = await this.dataSource.query(
      `
      SELECT
        v.id,
        v.word,
        v.cefr_level AS "cefrLevel",
        v.part_of_speech AS "partOfSpeech",
        v.sense_number AS "senseNumber",
        v.phonetic,
        v.vietnamese_meaning AS "vietnameseMeaning",
        v.example_en AS "exampleEn",
        v.example_vi AS "exampleVi",
        v.topic_id AS "topicId",
        v.audio_url AS "audioUrl"
      FROM vocabularies v
      WHERE LOWER(v.word) LIKE $1 ESCAPE '\\'
      ORDER BY LENGTH(v.word) ASC, v.word ASC, v.cefr_level ASC, v.part_of_speech ASC, v.sense_number ASC
      LIMIT $2;
      `,
      [`${escapedQ}%`, limit],
    );

    return rows;
  }

  async findVocabularyById(id: number) {
    const rows = await this.dataSource.query(
      `
      SELECT
        v.id,
        v.word,
        v.cefr_level AS "cefrLevel",
        v.part_of_speech AS "partOfSpeech",
        v.sense_number AS "senseNumber",
        v.phonetic,
        v.vietnamese_meaning AS "vietnameseMeaning",
        v.example_en AS "exampleEn",
        v.example_vi AS "exampleVi",
        v.topic_id AS "topicId",
        v.audio_url AS "audioUrl"
      FROM vocabularies v
      WHERE v.id = $1;
      `,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundException({
        code: 'VOCABULARY_NOT_FOUND',
        message: 'Từ vựng không tồn tại',
        details: null,
      });
    }

    return rows[0];
  }
}
