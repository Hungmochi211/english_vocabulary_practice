import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getAuthConfig } from '../../config/auth.config';
import {
  DistractorService,
  VocabCandidate,
} from '../algorithm/distractor.service';
import { StratifiedSamplingService } from '../algorithm/stratified-sampling.service';
import { stripCorrectAnswerFromSnapshot } from '../review/review.service';
import { LessonsQueryDto } from './dto/learning.dto';

@Injectable()
export class LearningService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly distractorService: DistractorService,
    private readonly stratifiedSampling: StratifiedSamplingService,
  ) {}

  private isStrictUnlockEnabled(): boolean {
    return getAuthConfig().strictUnlockMode;
  }

  async isLessonUnlockedForUser(userId: number, lessonId: number): Promise<{
    lesson: { id: number; topicId: number; cefrLevel: string; orderIndex: number; wordCount: number; title: string };
    isUnlocked: boolean;
  }> {
    const rows = await this.dataSource.query(
      `
      SELECT id, topic_id AS "topicId", cefr_level AS "cefrLevel", order_index AS "orderIndex",
             word_count AS "wordCount", title
      FROM lessons
      WHERE id = $1;
      `,
      [lessonId],
    );
    if (rows.length === 0) {
      throw new NotFoundException({
        code: 'LESSON_NOT_FOUND',
        message: 'Bài học không tồn tại',
        details: null,
      });
    }

    const lesson = rows[0];
    if (!this.isStrictUnlockEnabled() || lesson.orderIndex === 1) {
      return { lesson, isUnlocked: true };
    }

    const prevCompleted = await this.dataSource.query(
      `
      SELECT p.is_completed AS "isCompleted"
      FROM lessons prev
      INNER JOIN user_lesson_progress p
        ON p.lesson_id = prev.id AND p.user_id = $1
      WHERE prev.cefr_level = $2::cefr_level_enum
        AND prev.topic_id = $3
        AND prev.order_index = $4
      LIMIT 1;
      `,
      [userId, lesson.cefrLevel, lesson.topicId, lesson.orderIndex - 1],
    );

    const isUnlocked = prevCompleted.length > 0 && Boolean(prevCompleted[0].isCompleted);
    return { lesson, isUnlocked };
  }

  async getLessonsWithProgress(userId: number, query: LessonsQueryDto) {
    const conditions: string[] = [];
    const params: unknown[] = [userId];

    if (query.level) {
      params.push(query.level);
      conditions.push(`l.cefr_level = $${params.length}::cefr_level_enum`);
    }
    if (query.topicId !== undefined) {
      params.push(query.topicId);
      conditions.push(`l.topic_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const strict = this.isStrictUnlockEnabled();

    const rows = await this.dataSource.query(
      `
      SELECT
        l.id,
        l.topic_id AS "topicId",
        t.name_vi AS "topicNameVi",
        l.cefr_level AS "cefrLevel",
        l.title,
        l.order_index AS "orderIndex",
        l.word_count AS "wordCount",
        COALESCE(p.acquisition_completed, FALSE) AS "acquisitionCompleted",
        COALESCE(p.is_completed, FALSE) AS "isCompleted",
        COALESCE(p.best_score, 0.00)::float AS "bestScore",
        COALESCE(p.attempts_count, 0) AS "attemptsCount",
        COALESCE(CARDINALITY(p.opened_vocabulary_ids), 0)::int AS "openedCount"
      FROM lessons l
      INNER JOIN topics t ON t.id = l.topic_id
      LEFT JOIN user_lesson_progress p ON p.lesson_id = l.id AND p.user_id = $1
      ${whereClause}
      ORDER BY l.cefr_level ASC, l.topic_id ASC, l.order_index ASC;
      `,
      params,
    );

    // Xác định trạng thái mở khóa theo nhóm (cefrLevel, topicId)
    const completedSet = new Set<string>();
    for (const r of rows) {
      if (r.isCompleted) {
        completedSet.add(`${r.cefrLevel}:${r.topicId}:${r.orderIndex}`);
      }
    }

    return rows.map((r: Record<string, unknown>) => {
      const orderIndex = Number(r.orderIndex);
      const isUnlocked =
        !strict ||
        orderIndex === 1 ||
        completedSet.has(`${r.cefrLevel}:${r.topicId}:${orderIndex - 1}`);
      return {
        ...r,
        isUnlocked,
      };
    });
  }

  async openCard(userId: number, lessonId: number, vocabularyId: number) {
    const { lesson, isUnlocked } = await this.isLessonUnlockedForUser(userId, lessonId);
    if (!isUnlocked) {
      throw new ForbiddenException({
        code: 'LESSON_LOCKED',
        message: 'Bạn cần hoàn thành bài học liền trước với kết quả tối thiểu 80% để mở khóa bài này',
        details: null,
      });
    }

    // Xác thực từ vựng thuộc đúng lessonId trong lesson_vocabularies (CHK065)
    const linkRows = await this.dataSource.query(
      `SELECT id FROM lesson_vocabularies WHERE lesson_id = $1 AND vocabulary_id = $2;`,
      [lessonId, vocabularyId],
    );
    if (linkRows.length === 0) {
      throw new NotFoundException({
        code: 'CARD_NOT_IN_LESSON',
        message: 'Từ vựng không thuộc bài học này',
        details: null,
      });
    }

    // Đảm bảo có bản ghi progress và thêm nguyên tử vocabularyId nếu chưa có
    await this.dataSource.query(
      `
      INSERT INTO user_lesson_progress (user_id, lesson_id, opened_vocabulary_ids, acquisition_completed)
      VALUES ($1, $2, ARRAY[$3::int], ($4 <= 1))
      ON CONFLICT (user_id, lesson_id)
      DO UPDATE SET
        opened_vocabulary_ids = CASE
          WHEN $3 = ANY(user_lesson_progress.opened_vocabulary_ids)
            THEN user_lesson_progress.opened_vocabulary_ids
          ELSE array_append(user_lesson_progress.opened_vocabulary_ids, $3::int)
        END,
        acquisition_completed = (
          user_lesson_progress.acquisition_completed
          OR CARDINALITY(
            CASE
              WHEN $3 = ANY(user_lesson_progress.opened_vocabulary_ids)
                THEN user_lesson_progress.opened_vocabulary_ids
              ELSE array_append(user_lesson_progress.opened_vocabulary_ids, $3::int)
            END
          ) >= $4
        ),
        updated_at = NOW();
      `,
      [userId, lessonId, vocabularyId, lesson.wordCount],
    );

    const progressRows = await this.dataSource.query(
      `
      SELECT
        CARDINALITY(opened_vocabulary_ids)::int AS "openedCount",
        acquisition_completed AS "acquisitionCompleted"
      FROM user_lesson_progress
      WHERE user_id = $1 AND lesson_id = $2;
      `,
      [userId, lessonId],
    );

    return {
      lessonId,
      vocabularyId,
      openedCount: progressRows[0].openedCount,
      totalWords: lesson.wordCount,
      acquisitionCompleted: Boolean(progressRows[0].acquisitionCompleted),
    };
  }

  async startLessonPractice(userId: number, lessonId: number) {
    const { lesson, isUnlocked } = await this.isLessonUnlockedForUser(userId, lessonId);
    if (!isUnlocked) {
      throw new ForbiddenException({
        code: 'LESSON_LOCKED',
        message: 'Bạn cần hoàn thành bài học liền trước với kết quả tối thiểu 80% để mở khóa bài này',
        details: null,
      });
    }

    const progressRows = await this.dataSource.query(
      `
      SELECT acquisition_completed AS "acquisitionCompleted"
      FROM user_lesson_progress
      WHERE user_id = $1 AND lesson_id = $2;
      `,
      [userId, lessonId],
    );

    if (progressRows.length === 0 || !progressRows[0].acquisitionCompleted) {
      throw new ForbiddenException({
        code: 'ACQUISITION_REQUIRED',
        message: 'Bạn phải mở hết tất cả thẻ từ trong Bước 1 (Học nạp) trước khi làm bài tập',
        details: null,
      });
    }

    const vocabs: VocabCandidate[] = await this.dataSource.query(
      `
      SELECT
        v.id,
        v.word,
        v.cefr_level AS "cefrLevel",
        v.part_of_speech AS "partOfSpeech",
        v.topic_id AS "topicId",
        v.vietnamese_meaning AS "vietnameseMeaning",
        v.example_en AS "exampleEn",
        v.example_vi AS "exampleVi",
        v.phonetic,
        v.audio_url AS "audioUrl"
      FROM lesson_vocabularies lv
      INNER JOIN vocabularies v ON v.id = lv.vocabulary_id
      WHERE lv.lesson_id = $1
      ORDER BY lv.order_in_lesson ASC;
      `,
      [lessonId],
    );

    const snapshot = await this.distractorService.buildQuestionsSnapshot(vocabs);

    const inserted = await this.dataSource.query(
      `
      INSERT INTO quiz_attempts (user_id, lesson_id, attempt_type, status, questions_snapshot, total_questions)
      VALUES ($1, $2, 'lesson_practice', 'in_progress', $3::jsonb, $4)
      RETURNING id;
      `,
      [userId, lesson.id, JSON.stringify(snapshot), snapshot.length],
    );

    return {
      attemptId: inserted[0].id,
      attemptType: 'lesson_practice',
      lessonId: lesson.id,
      totalQuestions: snapshot.length,
      questions: stripCorrectAnswerFromSnapshot(snapshot),
    };
  }

  async startMixedQuiz(userId: number, totalQuestions = 20) {
    // Lấy toàn bộ từ vựng người học đã từng học (có trong user_sm2_reviews hoặc bài đã mở)
    const studiedVocabs: VocabCandidate[] = await this.dataSource.query(
      `
      SELECT DISTINCT
        v.id,
        v.word,
        v.cefr_level AS "cefrLevel",
        v.part_of_speech AS "partOfSpeech",
        v.topic_id AS "topicId",
        v.vietnamese_meaning AS "vietnameseMeaning",
        v.example_en AS "exampleEn",
        v.example_vi AS "exampleVi",
        v.phonetic,
        v.audio_url AS "audioUrl"
      FROM user_sm2_reviews r
      INNER JOIN vocabularies v ON v.id = r.vocabulary_id
      WHERE r.user_id = $1;
      `,
      [userId],
    );

    if (studiedVocabs.length === 0) {
      throw new BadRequestException({
        code: 'INSUFFICIENT_STUDIED_WORDS',
        message: 'Bạn chưa có từ vựng đã học nào để tạo bài kiểm tra tổng hợp',
        details: null,
      });
    }

    const buckets = new Map<number, VocabCandidate[]>();
    for (const v of studiedVocabs) {
      if (!buckets.has(v.topicId)) buckets.set(v.topicId, []);
      buckets.get(v.topicId)!.push(v);
    }

    const sampled = this.stratifiedSampling.sample(
      buckets,
      Math.min(totalQuestions, studiedVocabs.length),
    );
    const snapshot = await this.distractorService.buildQuestionsSnapshot(sampled);

    const inserted = await this.dataSource.query(
      `
      INSERT INTO quiz_attempts (user_id, lesson_id, attempt_type, status, questions_snapshot, total_questions)
      VALUES ($1, NULL, 'mixed_quiz', 'in_progress', $2::jsonb, $3)
      RETURNING id;
      `,
      [userId, JSON.stringify(snapshot), snapshot.length],
    );

    return {
      attemptId: inserted[0].id,
      attemptType: 'mixed_quiz',
      totalQuestions: snapshot.length,
      questions: stripCorrectAnswerFromSnapshot(snapshot),
    };
  }
}
