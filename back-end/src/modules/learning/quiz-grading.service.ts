import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  gradeTextAnswer,
  normalizeAnswer,
  GradingStatus,
} from '../algorithm/damerau-levenshtein.util';
import {
  deriveQualityRating,
  roundHalfUp,
  QualityRating,
} from '../algorithm/sm2-leitner.service';
import { GeneratedQuestionSnapshot } from '../algorithm/distractor.service';
import { ReviewService, Sm2UpdateItem } from '../review/review.service';
import { AuditService } from '../audit/audit.service';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { getTodayUtc7Date } from '../../common/utils/timezone.util';

export interface StreakProgressRecorder {
  recordDailyProgressAndUpdateStreak(
    qr: QueryRunner,
    params: {
      userId: number;
      studyDate: string;
      attemptType: 'lesson_practice' | 'sm2_review' | 'mixed_quiz';
      passedLesson: boolean;
      wordsLearnedDelta: number;
      wordsReviewedDelta: number;
    },
  ): Promise<{ currentStreak: number; longestStreak: number; streakQualified: boolean }>;
}

export const STREAK_PROGRESS_RECORDER = 'STREAK_PROGRESS_RECORDER';

@Injectable()
export class QuizGradingService {
  private streakRecorder: StreakProgressRecorder | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly reviewService: ReviewService,
    private readonly auditService: AuditService,
  ) {}

  setStreakRecorder(recorder: StreakProgressRecorder): void {
    this.streakRecorder = recorder;
  }

  async submitQuiz(
    userId: number,
    attemptId: number,
    dto: SubmitQuizDto,
    now: Date = new Date(),
  ) {
    const todayUtc7 = getTodayUtc7Date(now);
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const attempts = await qr.query(
        `
        SELECT id, user_id, lesson_id, attempt_type, status, questions_snapshot, due_count_snapshot, total_questions
        FROM quiz_attempts
        WHERE id = $1
        FOR UPDATE;
        `,
        [attemptId],
      );

      if (attempts.length === 0) {
        await qr.rollbackTransaction();
        throw new NotFoundException({
          code: 'ATTEMPT_NOT_FOUND',
          message: 'Phiên làm bài không tồn tại',
          details: null,
        });
      }

      const attempt = attempts[0];
      if (Number(attempt.user_id) !== userId) {
        await qr.rollbackTransaction();
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Bạn không có quyền nộp phiên làm bài này',
          details: null,
        });
      }

      if (attempt.status === 'submitted') {
        await qr.rollbackTransaction();
        throw new ConflictException({
          code: 'ATTEMPT_ALREADY_SUBMITTED',
          message: 'Phiên làm bài này đã được nộp trước đó',
          details: null,
        });
      }

      const snapshot: GeneratedQuestionSnapshot[] = attempt.questions_snapshot;
      const answerMap = new Map<
        number,
        { userAnswer?: string | null; responseTimeMs: number }
      >();
      for (const ans of dto.answers) {
        if (answerMap.has(ans.vocabularyId)) {
          await qr.rollbackTransaction();
          throw new BadRequestException({
            code: 'VALIDATION_ERROR',
            message: 'Dữ liệu gửi lên không hợp lệ',
            details: [`Duplicate answer for vocabularyId ${ans.vocabularyId}`],
          });
        }
        answerMap.set(ans.vocabularyId, ans);
      }

      let totalScore = 0;
      let wordsLearnedDelta = 0;
      const gradedItems: Array<{
        vocabularyId: number;
        word: string;
        practiceMode: string;
        userAnswer: string | null;
        correctAnswer: string;
        gradingStatus: GradingStatus;
        score: number;
        damerauDistance: number | null;
        soundexMatched: boolean | null;
        qualityRating: QualityRating;
        feedbackMessage: string;
      }> = [];
      const sm2Updates: Sm2UpdateItem[] = [];

      for (const q of snapshot) {
        const submitted = answerMap.get(q.vocabularyId);
        const rawAnswer = submitted?.userAnswer ?? null;
        const responseTimeMs = submitted?.responseTimeMs ?? 300000;

        let gradingStatus: GradingStatus;
        let score: 1.0 | 0.5 | 0.0;
        let damerauDistance: number | null = null;
        let soundexMatched: boolean | null = null;
        let feedbackMessage: string;

        if (q.practiceMode === 'multiple_choice') {
          const userNorm = normalizeAnswer(rawAnswer);
          const targetNorm = normalizeAnswer(q.correctAnswer);
          if (userNorm && userNorm === targetNorm) {
            gradingStatus = 'exact';
            score = 1.0;
            feedbackMessage = 'Chính xác!';
          } else {
            gradingStatus = 'incorrect';
            score = 0.0;
            feedbackMessage = `Chưa chính xác. Đáp án đúng là: ${q.correctAnswer}`;
          }
        } else {
          const res = gradeTextAnswer(rawAnswer, q.correctAnswer, q.practiceMode);
          gradingStatus = res.gradingStatus;
          score = res.score;
          damerauDistance = res.damerauDistance;
          soundexMatched = res.soundexMatched;
          feedbackMessage = res.feedbackMessage;
        }

        const qualityRating = deriveQualityRating(gradingStatus, responseTimeMs, rawAnswer);

        totalScore += score;
        if (attempt.attempt_type === 'lesson_practice' && score >= 0.5) {
          wordsLearnedDelta++;
        }

        await qr.query(
          `
          INSERT INTO quiz_attempt_answers (
            attempt_id, user_id, vocabulary_id, practice_mode, user_answer,
            grading_status, score, damerau_distance, soundex_matched,
            quality_rating, response_time_ms
          )
          VALUES ($1, $2, $3, $4::practice_mode_enum, $5, $6::grading_status_enum, $7, $8, $9, $10, $11);
          `,
          [
            attempt.id,
            userId,
            q.vocabularyId,
            q.practiceMode,
            rawAnswer,
            gradingStatus,
            score.toFixed(2),
            damerauDistance,
            soundexMatched,
            qualityRating,
            responseTimeMs,
          ],
        );

        gradedItems.push({
          vocabularyId: q.vocabularyId,
          word: q.word,
          practiceMode: q.practiceMode,
          userAnswer: rawAnswer,
          correctAnswer: q.correctAnswer,
          gradingStatus,
          score,
          damerauDistance,
          soundexMatched,
          qualityRating,
          feedbackMessage,
        });

        sm2Updates.push({
          vocabularyId: q.vocabularyId,
          qualityRating,
        });
      }

      const totalQuestions = Number(attempt.total_questions);
      const scorePercentage = roundHalfUp((totalScore / totalQuestions) * 100, 2);
      const passed = scorePercentage >= 80.0;

      await qr.query(
        `
        UPDATE quiz_attempts
        SET status = 'submitted',
            total_score = $1,
            score_percentage = $2,
            submitted_at = NOW()
        WHERE id = $3;
        `,
        [totalScore.toFixed(2), scorePercentage.toFixed(2), attempt.id],
      );

      let nextLessonUnlocked = false;
      if (attempt.attempt_type === 'lesson_practice' && attempt.lesson_id !== null) {
        // Kiểm tra trước đó đã hoàn thành chưa để biết lần này có mở khóa mới bài kế tiếp không
        const prevProg = await qr.query(
          `
          SELECT is_completed AS "isCompleted", best_score::float AS "bestScore"
          FROM user_lesson_progress
          WHERE user_id = $1 AND lesson_id = $2
          FOR UPDATE;
          `,
          [userId, attempt.lesson_id],
        );
        const wasCompleted = prevProg.length > 0 && Boolean(prevProg[0].isCompleted);

        await qr.query(
          `
          UPDATE user_lesson_progress
          SET attempts_count = attempts_count + 1,
              best_score = GREATEST(best_score, $1::decimal),
              is_completed = (is_completed OR $2::boolean),
              first_completed_at = CASE
                WHEN first_completed_at IS NULL AND $2::boolean THEN NOW()
                ELSE first_completed_at
              END,
              updated_at = NOW()
          WHERE user_id = $3 AND lesson_id = $4;
          `,
          [scorePercentage.toFixed(2), passed, userId, attempt.lesson_id],
        );

        if (passed && !wasCompleted) {
          nextLessonUnlocked = true;
        }
      }

      // Cập nhật SM-2 cho mọi câu đã nộp (bất kể đỗ hay trượt bài học - FR-009)
      const sm2Results = await this.reviewService.applySm2UpdatesInTransaction(
        qr,
        userId,
        sm2Updates,
        todayUtc7,
      );

      // Cập nhật Streak & Daily Study Log trong cùng transaction (nếu đã gắn Gamification)
      let streakResult: { currentStreak: number; longestStreak: number; streakQualified: boolean } | null = null;
      if (this.streakRecorder) {
        streakResult = await this.streakRecorder.recordDailyProgressAndUpdateStreak(qr, {
          userId,
          studyDate: todayUtc7,
          attemptType: attempt.attempt_type,
          passedLesson: attempt.attempt_type === 'lesson_practice' && passed,
          wordsLearnedDelta,
          wordsReviewedDelta: attempt.attempt_type === 'sm2_review' ? snapshot.length : 0,
        });
      }

      await qr.commitTransaction();

      if (nextLessonUnlocked && attempt.lesson_id !== null) {
        await this.auditService.log({
          actorUserId: userId,
          action: 'LESSON_UNLOCKED',
          targetType: 'lesson',
          targetId: attempt.lesson_id,
          status: 'SUCCESS',
          metadata: { scorePercentage },
        });
      }

      return {
        attemptId: attempt.id,
        attemptType: attempt.attempt_type,
        totalQuestions,
        totalScore,
        scorePercentage,
        passed,
        nextLessonUnlocked,
        answers: gradedItems,
        sm2Updates: sm2Results,
        streak: streakResult,
      };
    } catch (err) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      throw err;
    } finally {
      await qr.release();
    }
  }
}
