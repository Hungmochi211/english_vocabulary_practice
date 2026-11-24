import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  DistractorService,
  VocabCandidate,
  GeneratedQuestionSnapshot,
} from '../algorithm/distractor.service';
import {
  calculateNextSm2State,
  QualityRating,
} from '../algorithm/sm2-leitner.service';
import { getTodayUtc7Date } from '../../common/utils/timezone.util';

export interface Sm2UpdateItem {
  vocabularyId: number;
  qualityRating: QualityRating;
}

export interface Sm2UpdateResult {
  vocabularyId: number;
  easinessFactor: number;
  repetitions: number;
  intervalDays: number;
  leitnerBox: number;
  nextReviewDate: string;
}

export function stripCorrectAnswerFromSnapshot(
  questions: GeneratedQuestionSnapshot[],
) {
  return questions.map(({ correctAnswer: _hidden, ...publicQuestion }) => publicQuestion);
}

@Injectable()
export class ReviewService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly distractorService: DistractorService,
  ) {}

  async getDueReviews(userId: number, limit = 20) {
    const today = getTodayUtc7Date();

    const [countRows, items] = await Promise.all([
      this.dataSource.query(
        `
        SELECT COUNT(*)::int AS "totalDue"
        FROM user_sm2_reviews
        WHERE user_id = $1 AND next_review_date <= $2::date;
        `,
        [userId, today],
      ),
      this.dataSource.query(
        `
        SELECT
          r.id AS "reviewId",
          r.vocabulary_id AS "vocabularyId",
          v.word,
          v.cefr_level AS "cefrLevel",
          v.part_of_speech AS "partOfSpeech",
          v.phonetic,
          v.vietnamese_meaning AS "vietnameseMeaning",
          v.example_en AS "exampleEn",
          v.example_vi AS "exampleVi",
          v.topic_id AS "topicId",
          v.audio_url AS "audioUrl",
          r.easiness_factor::float AS "easinessFactor",
          r.repetitions,
          r.interval_days AS "intervalDays",
          TO_CHAR(r.next_review_date, 'YYYY-MM-DD') AS "nextReviewDate",
          r.leitner_box AS "leitnerBox",
          r.last_quality_rating AS "lastQualityRating"
        FROM user_sm2_reviews r
        INNER JOIN vocabularies v ON v.id = r.vocabulary_id
        WHERE r.user_id = $1 AND r.next_review_date <= $2::date
        ORDER BY r.leitner_box ASC, r.next_review_date ASC, r.id ASC
        LIMIT $3;
        `,
        [userId, today, limit],
      ),
    ]);

    return {
      totalDue: countRows[0]?.totalDue ?? 0,
      items,
    };
  }

  async startReviewSession(userId: number, limit = 20) {
    const due = await this.getDueReviews(userId, limit);
    if (due.totalDue === 0 || due.items.length === 0) {
      throw new BadRequestException({
        code: 'NO_DUE_REVIEWS',
        message: 'Hiện tại không có từ vựng nào đến hạn ôn tập hôm nay',
        details: null,
      });
    }

    const candidates: VocabCandidate[] = due.items.map((item: Record<string, unknown>) => ({
      id: Number(item.vocabularyId),
      word: String(item.word),
      cefrLevel: String(item.cefrLevel),
      partOfSpeech: String(item.partOfSpeech),
      topicId: Number(item.topicId),
      vietnameseMeaning: String(item.vietnameseMeaning),
      exampleEn: String(item.exampleEn || ''),
      exampleVi: String(item.exampleVi || ''),
      phonetic: String(item.phonetic || ''),
      audioUrl: (item.audioUrl ?? null) as string | null,
    }));

    const snapshot = await this.distractorService.buildQuestionsSnapshot(candidates);

    const inserted = await this.dataSource.query(
      `
      INSERT INTO quiz_attempts (user_id, lesson_id, attempt_type, status, questions_snapshot, due_count_snapshot, total_questions)
      VALUES ($1, NULL, 'sm2_review', 'in_progress', $2::jsonb, $3, $4)
      RETURNING id;
      `,
      [userId, JSON.stringify(snapshot), due.totalDue, snapshot.length],
    );

    return {
      attemptId: inserted[0].id,
      attemptType: 'sm2_review',
      totalQuestions: snapshot.length,
      totalDueAtStart: due.totalDue,
      questions: stripCorrectAnswerFromSnapshot(snapshot),
    };
  }

  async applySm2UpdatesInTransaction(
    qr: QueryRunner,
    userId: number,
    updates: Sm2UpdateItem[],
    todayUtc7: string,
  ): Promise<Sm2UpdateResult[]> {
    // Sắp xếp theo vocabularyId tăng dần để tránh deadlock giữa các transaction đồng thời (R4)
    const sorted = [...updates].sort((a, b) => a.vocabularyId - b.vocabularyId);
    const results: Sm2UpdateResult[] = [];

    for (const item of sorted) {
      // Khởi tạo an toàn nếu chưa có bản ghi (chống race condition lần đầu - CHK068)
      await qr.query(
        `
        INSERT INTO user_sm2_reviews (
          user_id, vocabulary_id, easiness_factor, repetitions, interval_days,
          next_review_date, leitner_box, last_quality_rating, last_reviewed_at
        )
        VALUES ($1, $2, 2.50, 0, 0, $3::date, 1, NULL, NULL)
        ON CONFLICT (user_id, vocabulary_id) DO NOTHING;
        `,
        [userId, item.vocabularyId, todayUtc7],
      );

      // Khóa hàng tuần tự (SELECT ... FOR UPDATE) để áp dụng mỗi kết quả đúng 1 lần (US4-AS7)
      const locked = await qr.query(
        `
        SELECT easiness_factor, repetitions, interval_days
        FROM user_sm2_reviews
        WHERE user_id = $1 AND vocabulary_id = $2
        FOR UPDATE;
        `,
        [userId, item.vocabularyId],
      );

      const current = locked[0];
      const next = calculateNextSm2State(
        {
          easinessFactor: Number(current.easiness_factor),
          repetitions: Number(current.repetitions),
          intervalDays: Number(current.interval_days),
        },
        item.qualityRating,
        todayUtc7,
      );

      await qr.query(
        `
        UPDATE user_sm2_reviews
        SET easiness_factor = $1,
            repetitions = $2,
            interval_days = $3,
            next_review_date = $4::date,
            leitner_box = $5,
            last_quality_rating = $6,
            last_reviewed_at = NOW(),
            updated_at = NOW()
        WHERE user_id = $7 AND vocabulary_id = $8;
        `,
        [
          next.easinessFactor.toFixed(2),
          next.repetitions,
          next.intervalDays,
          next.nextReviewDate,
          next.leitnerBox,
          item.qualityRating,
          userId,
          item.vocabularyId,
        ],
      );

      results.push({
        vocabularyId: item.vocabularyId,
        easinessFactor: next.easinessFactor,
        repetitions: next.repetitions,
        intervalDays: next.intervalDays,
        leitnerBox: next.leitnerBox,
        nextReviewDate: next.nextReviewDate,
      });
    }

    return results;
  }
}
