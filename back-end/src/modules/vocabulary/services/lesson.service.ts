import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueryLessonsDto } from '../dto/query-lessons.dto';

@Injectable()
export class LessonService {
  constructor(private readonly dataSource: DataSource) {}

  private async execQuery<T = any>(
    text: string,
    values: unknown[] = [],
    name?: string,
  ): Promise<T[]> {
    const masterPool = (this.dataSource.driver as unknown as { master?: { query: (q: unknown) => Promise<{ rows: T[] }> } })?.master;
    if (masterPool && typeof masterPool.query === 'function') {
      const res = await masterPool.query(name ? { name, text, values } : { text, values });
      return res.rows;
    }
    return this.dataSource.query(text, values);
  }

  async findAllTopicsWithLessonCount() {
    return this.execQuery(
      `
      SELECT
        t.id,
        t.code,
        t.name,
        t.name_vi AS "nameVi",
        t.description,
        COUNT(l.id)::int AS "totalLessons"
      FROM topics t
      LEFT JOIN lessons l ON l.topic_id = t.id
      GROUP BY t.id
      ORDER BY t.id ASC;
      `,
      [],
      'stmt_find_all_topics_with_count',
    );
  }

  async findLessons(query: QueryLessonsDto) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (query.level) {
      params.push(query.level);
      conditions.push(`l.cefr_level = $${params.length}::cefr_level_enum`);
    }

    if (query.topicId !== undefined) {
      params.push(query.topicId);
      conditions.push(`l.topic_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const stmtName = `stmt_find_lessons_${query.level ? 'lvl' : 'all'}_${query.topicId !== undefined ? 'top' : 'all'}`;

    const rows = await this.execQuery<{ items: unknown[] }>(
      `
      SELECT COALESCE(
        json_agg(
          json_build_object(
            'id', l.id,
            'topicId', l.topic_id,
            'topicNameVi', t.name_vi,
            'cefrLevel', l.cefr_level,
            'title', l.title,
            'orderIndex', l.order_index,
            'wordCount', l.word_count
          ) ORDER BY l.cefr_level ASC, l.topic_id ASC, l.order_index ASC
        ),
        '[]'::json
      ) AS items
      FROM lessons l
      INNER JOIN topics t ON t.id = l.topic_id
      ${whereClause};
      `,
      params,
      stmtName,
    );

    return rows[0]?.items ?? [];
  }

  async findLessonDetailById(id: number) {
    const rows = await this.execQuery(
      `
      SELECT
        l.id,
        l.topic_id AS "topicId",
        t.name_vi AS "topicNameVi",
        l.cefr_level AS "cefrLevel",
        l.title,
        l.order_index AS "orderIndex",
        l.word_count AS "wordCount",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', v.id,
                'word', v.word,
                'cefrLevel', v.cefr_level,
                'partOfSpeech', v.part_of_speech,
                'senseNumber', v.sense_number,
                'phonetic', v.phonetic,
                'vietnameseMeaning', v.vietnamese_meaning,
                'exampleEn', v.example_en,
                'exampleVi', v.example_vi,
                'topicId', v.topic_id,
                'audioUrl', v.audio_url,
                'orderInLesson', lv.order_in_lesson
              ) ORDER BY lv.order_in_lesson ASC
            )
            FROM lesson_vocabularies lv
            INNER JOIN vocabularies v ON v.id = lv.vocabulary_id
            WHERE lv.lesson_id = l.id
          ),
          '[]'::json
        ) AS vocabularies
      FROM lessons l
      INNER JOIN topics t ON t.id = l.topic_id
      WHERE l.id = $1;
      `,
      [id],
      'stmt_find_lesson_detail_by_id',
    );

    if (rows.length === 0) {
      throw new NotFoundException({
        code: 'LESSON_NOT_FOUND',
        message: 'Bài học không tồn tại',
        details: null,
      });
    }

    const { vocabularies, ...lesson } = rows[0];
    return {
      lesson,
      vocabularies,
    };
  }
}
