import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  QuizGradingService,
  StreakProgressRecorder,
} from '../learning/quiz-grading.service';
import {
  getTodayUtc7Date,
  addDaysUtc7,
  getLast7DaysUtc7,
} from '../../common/utils/timezone.util';

export interface WeeklyLeaderboardMemberDto {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  level: 'A1' | 'A2' | 'B1' | 'B2';
  weeklyXp: number;
  wordsThisWeek: number;
  streakDays: number;
  badges: string[];
  isCurrentUser: boolean;
  rank: number;
}

export function computeLeaderboardBadges(metrics: {
  rank: number;
  weeklyXp: number;
  wordsThisWeek: number;
  streakDays: number;
}): string[] {
  const badges: string[] = [];
  if (metrics.rank === 1 && metrics.weeklyXp > 0) {
    badges.push('Top 1 Tuần');
  }
  if (metrics.streakDays >= 21) {
    badges.push('Bền bỉ 21 ngày');
  } else if (metrics.streakDays >= 7) {
    badges.push('Streak 7+ ngày');
  }
  if (metrics.wordsThisWeek >= 50) {
    badges.push('Siêng năng');
  }
  if (badges.length === 0) {
    badges.push(metrics.weeklyXp > 0 || metrics.wordsThisWeek > 0 ? 'Học viên tích cực' : 'Học viên mới');
  }
  return badges;
}

@Injectable()
export class StreakService implements StreakProgressRecorder, OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    private readonly quizGradingService: QuizGradingService,
  ) {}

  onModuleInit(): void {
    this.quizGradingService.setStreakRecorder(this);
  }

  async recordDailyProgressAndUpdateStreak(
    qr: QueryRunner,
    params: {
      userId: number;
      studyDate: string;
      attemptType: 'lesson_practice' | 'sm2_review' | 'mixed_quiz';
      passedLesson: boolean;
      wordsLearnedDelta: number;
      wordsReviewedDelta: number;
    },
  ): Promise<{ currentStreak: number; longestStreak: number; streakQualified: boolean }> {
    const {
      userId,
      studyDate,
      attemptType,
      passedLesson,
      wordsLearnedDelta,
      wordsReviewedDelta,
    } = params;

    const lessonDelta = attemptType === 'lesson_practice' && passedLesson ? 1 : 0;
    const sm2SessionDelta = attemptType === 'sm2_review' ? 1 : 0;

    // Đảm bảo có bản ghi daily_study_logs cho (user_id, study_date) và khóa hàng FOR UPDATE (CHK050)
    await qr.query(
      `
      INSERT INTO daily_study_logs (user_id, study_date)
      VALUES ($1, $2::date)
      ON CONFLICT (user_id, study_date) DO NOTHING;
      `,
      [userId, studyDate],
    );

    const logRows = await qr.query(
      `
      SELECT id, words_learned, words_reviewed, lesson_practices_completed, sm2_sessions_completed, streak_qualified
      FROM daily_study_logs
      WHERE user_id = $1 AND study_date = $2::date
      FOR UPDATE;
      `,
      [userId, studyDate],
    );

    const log = logRows[0];
    const nextWordsLearned = Number(log.words_learned) + wordsLearnedDelta;
    const nextWordsReviewed = Number(log.words_reviewed) + wordsReviewedDelta;
    const nextLessonCompleted = Number(log.lesson_practices_completed) + lessonDelta;
    const nextSm2Sessions = Number(log.sm2_sessions_completed) + sm2SessionDelta;

    let qualifiedNow = Boolean(log.streak_qualified);
    if (!qualifiedNow) {
      if (nextLessonCompleted >= 1 || nextWordsReviewed >= 10) {
        qualifiedNow = true;
      } else if (nextSm2Sessions >= 1 && nextWordsReviewed >= 1) {
        // Kiểm tra sau khi nộp phiên SM-2 còn từ nào đến hạn hôm nay không (FR-012, US5-AS2)
        const remainingRows = await qr.query(
          `
          SELECT COUNT(*)::int AS remaining
          FROM user_sm2_reviews
          WHERE user_id = $1 AND next_review_date <= $2::date;
          `,
          [userId, studyDate],
        );
        if ((remainingRows[0]?.remaining ?? 0) === 0) {
          qualifiedNow = true;
        }
      }
    }

    const becameQualified = !Boolean(log.streak_qualified) && qualifiedNow;

    await qr.query(
      `
      UPDATE daily_study_logs
      SET words_learned = $1,
          words_reviewed = $2,
          lesson_practices_completed = $3,
          sm2_sessions_completed = $4,
          streak_qualified = $5,
          updated_at = NOW()
      WHERE id = $6;
      `,
      [
        nextWordsLearned,
        nextWordsReviewed,
        nextLessonCompleted,
        nextSm2Sessions,
        qualifiedNow,
        log.id,
      ],
    );

    // Khóa hàng user_streaks để đọc/cập nhật nguyên tử
    await qr.query(
      `
      INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_study_date)
      VALUES ($1, 0, 0, NULL)
      ON CONFLICT (user_id) DO NOTHING;
      `,
      [userId],
    );

    const streakRows = await qr.query(
      `
      SELECT current_streak, longest_streak, TO_CHAR(last_study_date, 'YYYY-MM-DD') AS last_study_date
      FROM user_streaks
      WHERE user_id = $1
      FOR UPDATE;
      `,
      [userId],
    );

    let currentStreak = Number(streakRows[0].current_streak);
    let longestStreak = Number(streakRows[0].longest_streak);
    const lastStudyDate: string | null = streakRows[0].last_study_date;

    if (becameQualified && lastStudyDate !== studyDate) {
      const yesterday = addDaysUtc7(studyDate, -1);
      if (lastStudyDate === yesterday) {
        currentStreak += 1;
      } else {
        currentStreak = 1;
      }
      longestStreak = Math.max(longestStreak, currentStreak);

      await qr.query(
        `
        UPDATE user_streaks
        SET current_streak = $1,
            longest_streak = $2,
            last_study_date = $3::date,
            updated_at = NOW()
        WHERE user_id = $4;
        `,
        [currentStreak, longestStreak, studyDate, userId],
      );
    }

    return {
      currentStreak,
      longestStreak,
      streakQualified: qualifiedNow,
    };
  }

  async getOverviewStats(userId: number, now: Date = new Date()) {
    const today = getTodayUtc7Date(now);
    const yesterday = addDaysUtc7(today, -1);
    const last7Dates = getLast7DaysUtc7(now);

    const [streakRows, boxRows, dueRows, logRows, completedLessonsRows, totalXpRows] = await Promise.all([
      this.dataSource.query(
        `
        SELECT current_streak, longest_streak, TO_CHAR(last_study_date, 'YYYY-MM-DD') AS last_study_date
        FROM user_streaks
        WHERE user_id = $1;
        `,
        [userId],
      ),
      this.dataSource.query(
        `
        SELECT leitner_box AS box, COUNT(*)::int AS cnt
        FROM user_sm2_reviews
        WHERE user_id = $1
        GROUP BY leitner_box;
        `,
        [userId],
      ),
      this.dataSource.query(
        `
        SELECT COUNT(*)::int AS cnt
        FROM user_sm2_reviews
        WHERE user_id = $1 AND next_review_date <= $2::date;
        `,
        [userId, today],
      ),
      this.dataSource.query(
        `
        SELECT
          TO_CHAR(study_date, 'YYYY-MM-DD') AS date,
          words_learned AS "wordsLearned",
          words_reviewed AS "wordsReviewed",
          lesson_practices_completed AS "lessonPracticesCompleted",
          sm2_sessions_completed AS "sm2SessionsCompleted",
          streak_qualified AS "streakQualified"
        FROM daily_study_logs
        WHERE user_id = $1 AND study_date >= $2::date AND study_date <= $3::date;
        `,
        [userId, last7Dates[0], last7Dates[6]],
      ),
      this.dataSource.query(
        `
        SELECT COUNT(*)::int AS cnt
        FROM user_lesson_progress
        WHERE user_id = $1 AND is_completed = TRUE;
        `,
        [userId],
      ),
      this.dataSource.query(
        `
        SELECT COALESCE(ROUND(SUM(total_score) * 10), 0)::int AS xp
        FROM quiz_attempts
        WHERE user_id = $1 AND status = 'submitted';
        `,
        [userId],
      ),
    ]);

    const rawCurrent = streakRows.length > 0 ? Number(streakRows[0].current_streak) : 0;
    const longestStreak = streakRows.length > 0 ? Number(streakRows[0].longest_streak) : 0;
    const lastStudyDate: string | null = streakRows[0]?.last_study_date ?? null;

    // Edge Case 2: Nếu last_study_date <= hôm nay - 2 ngày -> hiển thị ngay currentStreak = 0
    const effectiveCurrentStreak =
      lastStudyDate && lastStudyDate >= yesterday ? rawCurrent : 0;

    const leitnerBoxes: Record<string, number> = {
      box1: 0,
      box2: 0,
      box3: 0,
      box4: 0,
      box5: 0,
    };
    let learnedWordsCount = 0;
    for (const r of boxRows) {
      const cnt = Number(r.cnt);
      leitnerBoxes[`box${r.box}`] = cnt;
      learnedWordsCount += cnt;
    }

    const logsByDate = new Map<string, Record<string, unknown>>();
    for (const r of logRows) {
      logsByDate.set(r.date, r);
    }

    const last7Days = last7Dates.map((d) => {
      const found = logsByDate.get(d);
      return {
        date: d,
        wordsLearned: found ? Number(found.wordsLearned) : 0,
        wordsReviewed: found ? Number(found.wordsReviewed) : 0,
        lessonPracticesCompleted: found ? Number(found.lessonPracticesCompleted) : 0,
        sm2SessionsCompleted: found ? Number(found.sm2SessionsCompleted) : 0,
        streakQualified: found ? Boolean(found.streakQualified) : false,
      };
    });

    return {
      currentStreak: effectiveCurrentStreak,
      longestStreak,
      lastStudyDate,
      dueReviewsToday: dueRows[0]?.cnt ?? 0,
      completedLessonsCount: completedLessonsRows[0]?.cnt ?? 0,
      learnedWordsCount,
      totalXp: totalXpRows[0]?.xp ?? 0,
      leitnerBoxes,
      last7Days,
    };
  }

  async getAdminStats() {
    const today = getTodayUtc7Date();
    const [usersRow, activeTodayRow, attemptsRow, attemptsTodayRow, vocabRow, sm2Row] =
      await Promise.all([
        this.dataSource.query(
          `
          SELECT
            COUNT(*)::int AS "totalUsers",
            COUNT(*) FILTER (WHERE is_active = TRUE)::int AS "activeUsers"
          FROM users;
          `,
        ),
        this.dataSource.query(
          `
          SELECT COUNT(DISTINCT user_id)::int AS "activeLearnersToday"
          FROM daily_study_logs
          WHERE study_date = $1::date;
          `,
          [today],
        ),
        this.dataSource.query(
          `
          SELECT COUNT(*)::int AS "totalSubmittedQuizzes"
          FROM quiz_attempts
          WHERE status = 'submitted';
          `,
        ),
        this.dataSource.query(
          `
          SELECT COUNT(*)::int AS "totalAttemptsToday"
          FROM quiz_attempts
          WHERE status = 'submitted'
            AND (submitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = $1::date;
          `,
          [today],
        ),
        this.dataSource.query(
          `SELECT COUNT(*)::int AS "totalVocabularyCount" FROM vocabularies;`,
        ),
        this.dataSource.query(
          `SELECT COUNT(*)::int AS "totalSm2CardsTracked" FROM user_sm2_reviews;`,
        ),
      ]);

    return {
      totalUsers: usersRow[0]?.totalUsers ?? 0,
      activeUsers: usersRow[0]?.activeUsers ?? 0,
      activeLearnersToday: activeTodayRow[0]?.activeLearnersToday ?? 0,
      totalSubmittedQuizzes: attemptsRow[0]?.totalSubmittedQuizzes ?? 0,
      totalAttemptsToday: attemptsTodayRow[0]?.totalAttemptsToday ?? 0,
      totalVocabularyCount: vocabRow[0]?.totalVocabularyCount ?? 0,
      totalSm2CardsTracked: sm2Row[0]?.totalSm2CardsTracked ?? 0,
    };
  }

  async getWeeklyLeaderboard(
    currentUserId: number,
    limit = 20,
    now: Date = new Date(),
  ): Promise<WeeklyLeaderboardMemberDto[]> {
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit || 20)));
    const today = getTodayUtc7Date(now);
    const yesterday = addDaysUtc7(today, -1);
    const last7Dates = getLast7DaysUtc7(now);
    const weekStartDate = last7Dates[0];

    const rows: Array<{
      userId: number;
      fullName: string;
      avatarUrl: string | null;
      level: string;
      weeklyXp: number;
      wordsThisWeek: number;
      streakDays: number;
      rank: number;
    }> = await this.dataSource.query(
      `
      WITH weekly_xp AS (
        SELECT
          user_id,
          COALESCE(ROUND(SUM(total_score) * 10), 0)::int AS xp
        FROM quiz_attempts
        WHERE status = 'submitted'
          AND submitted_at IS NOT NULL
          AND (submitted_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date >= $2::date
        GROUP BY user_id
      ),
      weekly_words AS (
        SELECT
          user_id,
          COALESCE(SUM(words_learned + words_reviewed), 0)::int AS words
        FROM daily_study_logs
        WHERE study_date >= $2::date
        GROUP BY user_id
      ),
      ranked AS (
        SELECT
          u.id AS "userId",
          u.full_name AS "fullName",
          u.avatar_url AS "avatarUrl",
          u.target_level::text AS level,
          COALESCE(wx.xp, 0)::int AS "weeklyXp",
          COALESCE(ww.words, 0)::int AS "wordsThisWeek",
          CASE
            WHEN us.last_study_date IS NOT NULL AND us.last_study_date >= $3::date
              THEN COALESCE(us.current_streak, 0)::int
            ELSE 0
          END AS "streakDays",
          ROW_NUMBER() OVER (
            ORDER BY
              COALESCE(wx.xp, 0) DESC,
              CASE
                WHEN us.last_study_date IS NOT NULL AND us.last_study_date >= $3::date
                  THEN COALESCE(us.current_streak, 0)
                ELSE 0
              END DESC,
              COALESCE(ww.words, 0) DESC,
              u.full_name ASC,
              u.id ASC
          )::int AS rank
        FROM users u
        LEFT JOIN weekly_xp wx ON wx.user_id = u.id
        LEFT JOIN weekly_words ww ON ww.user_id = u.id
        LEFT JOIN user_streaks us ON us.user_id = u.id
        WHERE u.is_active = TRUE
          AND (u.role = 'learner' OR u.id = $1)
      )
      SELECT
        "userId",
        "fullName",
        "avatarUrl",
        level,
        "weeklyXp",
        "wordsThisWeek",
        "streakDays",
        rank
      FROM ranked
      WHERE rank <= $4 OR "userId" = $1
      ORDER BY rank ASC;
      `,
      [currentUserId, weekStartDate, yesterday, safeLimit],
    );

    const validLevels = new Set(['A1', 'A2', 'B1', 'B2']);

    return rows.map((r) => {
      const weeklyXp = Math.max(0, Number(r.weeklyXp ?? 0));
      const wordsThisWeek = Math.max(0, Number(r.wordsThisWeek ?? 0));
      const streakDays = Math.max(0, Number(r.streakDays ?? 0));
      const rank = Math.max(1, Number(r.rank ?? 1));
      const level = (validLevels.has(String(r.level)) ? String(r.level) : 'B1') as
        | 'A1'
        | 'A2'
        | 'B1'
        | 'B2';

      return {
        userId: String(r.userId),
        fullName: String(r.fullName || 'Học viên'),
        avatarUrl: typeof r.avatarUrl === 'string' && r.avatarUrl.trim() ? r.avatarUrl : null,
        level,
        weeklyXp,
        wordsThisWeek,
        streakDays,
        badges: computeLeaderboardBadges({ rank, weeklyXp, wordsThisWeek, streakDays }),
        isCurrentUser: Number(r.userId) === currentUserId,
        rank,
      };
    });
  }
}
