import { describe, expect, it } from 'vitest';
import {
  normalizeAdminSystemStats,
  normalizeAdminUserRow,
  normalizeAuditLogEntry,
  normalizeAuthSession,
  normalizeLessonProgress,
  normalizePaginatedData,
  normalizeQuizAttemptStart,
  normalizeQuizSubmitResult,
  normalizeStatsOverview,
  normalizeTopic,
} from '@/services/api/normalizers';

describe('Backend 001/002 -> Frontend normalizers', () => {
  it('maps BE AuthSession.expiresIn to expiresInSeconds and Topic code/totalLessons', () => {
    const auth = normalizeAuthSession({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 900,
      expiresInSeconds: undefined as unknown as number,
      user: {
        id: 1,
        email: 'sv01@vnua.edu.vn',
        fullName: 'SV 01',
        avatarUrl: null,
        targetLevel: 'B1',
        role: 'learner',
        emailReminderEnabled: true,
        isActive: true,
        createdAt: '2026-11-24T00:00:00Z',
      },
    });
    expect(auth.expiresInSeconds).toBe(900);

    const topic = normalizeTopic({
      id: 1,
      name: 'Environment',
      code: 'environment',
      totalLessons: 12,
      slug: undefined as unknown as string,
    });
    expect(topic.slug).toBe('environment');
    expect(topic.lessonCount).toBe(12);
  });

  it('normalizes BE flat QuizQuestion snapshot and QuizSubmitResult payload', () => {
    const started = normalizeQuizAttemptStart({
      attemptId: 99,
      attemptType: 'lesson_practice',
      totalQuestions: 2,
      questions: [
        {
          vocabularyId: 10,
          word: 'abandon',
          phonetic: '/əˈbændən/',
          partOfSpeech: 'v.',
          cefrLevel: 'B2',
          practiceMode: 'multiple_choice',
          prompt: 'Chọn nghĩa tiếng Việt đúng của từ "abandon" (v.)',
          vietnameseMeaning: 'từ bỏ',
          exampleEn: 'Never abandon hope.',
          audioUrl: null,
          options: ['từ bỏ', 'bảo vệ', 'mở rộng', 'xây dựng'],
        },
        {
          vocabularyId: 11,
          word: 'brown',
          partOfSpeech: 'adj.',
          practiceMode: 'typing',
          prompt: 'Gõ từ tiếng Anh có nghĩa "có màu nâu" (adj.)',
          vietnameseMeaning: 'có màu nâu',
          exampleEn: 'The browns and greens in this painting give it a nice woodsy feel.',
          audioUrl: null,
          options: null,
        },
      ],
    });

    expect(started.attemptType).toBe('lesson_practice');
    expect(started.questions[0].prompt.word).toBe('abandon');
    expect(started.questions[0].prompt.options).toHaveLength(4);
    expect(started.questions[1].prompt.vietnameseMeaning).toBe('có màu nâu');
    expect(started.questions[1].prompt.clozeExampleEn).toBe(
      'The _____ and greens in this painting give it a nice woodsy feel.',
    );

    const submitted = normalizeQuizSubmitResult({
      attemptId: 99,
      attemptType: 'lesson_practice',
      totalQuestions: 2,
      totalScore: 1.5,
      scorePercentage: 75,
      passed: false,
      nextLessonUnlocked: false,
      answers: [
        {
          vocabularyId: 10,
          word: 'abandon',
          phonetic: '/əˈbændən/',
          vietnameseMeaning: 'từ bỏ',
          userAnswer: 'từ bỏ',
          gradingStatus: 'exact',
          score: 1,
          feedbackMessage: 'Chính xác!',
        },
        {
          vocabularyId: 11,
          word: 'protect',
          vietnameseMeaning: 'bảo vệ',
          userAnswer: 'protetc',
          gradingStatus: 'near_match',
          score: 0.5,
          feedbackMessage: 'Gần đúng',
        },
      ],
      sm2Updates: [
        { vocabularyId: 10, leitnerBox: 2, nextReviewDate: '2026-11-25' },
        { vocabularyId: 11, leitnerBox: 1, nextReviewDate: '2026-11-24' },
      ],
      streak: { currentStreak: 4, longestStreak: 7, streakQualified: true },
    });

    expect(submitted.scorePercent).toBe(75);
    expect(submitted.correctCount).toBe(1);
    expect(submitted.xpEarned).toBe(15);
    expect(submitted.nextLessonUnlockedId).toBeNull();
    expect(submitted.streakUpdated).toEqual({ currentStreak: 4, completedToday: true });
    expect(submitted.results[0].pointsAwarded).toBe(1);
    expect(submitted.results[0].newLeitnerBox).toBe(2);
    expect(submitted.results[1].nextReviewDate).toBe('2026-11-24');
  });

  it('normalizes BE /learning/lessons, /stats/overview, and /admin/* payloads', () => {
    const lesson = normalizeLessonProgress({
      id: 5,
      topicId: 2,
      topicNameVi: 'Môi trường',
      cefrLevel: 'A1',
      title: 'Bài 1',
      orderIndex: 1,
      wordCount: 15,
      openedCount: 5,
      acquisitionCompleted: false,
      isCompleted: false,
      isUnlocked: true,
      bestScore: 0,
    });
    expect(lesson.lessonId).toBe(5);
    expect(lesson.topicName).toBe('Môi trường');

    const overview = normalizeStatsOverview({
      currentStreak: 3,
      longestStreak: 5,
      dueReviewsToday: 4,
      learnedWordsCount: 18,
      totalXp: 240,
      leitnerBoxes: { box1: 10, box2: 5, box3: 3, box4: 0, box5: 0 },
      last7Days: [
        { date: '2026-11-24', wordsLearned: 12, wordsReviewed: 4, streakQualified: true },
      ],
    });
    expect(overview.dueReviewsCount).toBe(4);
    expect(overview.completedToday).toBe(true);
    expect(overview.leitnerDistribution.box2).toBe(5);
    expect(overview.last7Days[0].wordsStudied).toBe(16);

    const adminStats = normalizeAdminSystemStats({
      totalUsers: 20,
      activeLearnersToday: 7,
      totalVocabularyCount: 3000,
      totalAttemptsToday: 14,
    });
    expect(adminStats.activeUsersToday).toBe(7);
    expect(adminStats.totalVocabularyCount).toBe(3000);
    expect(adminStats.totalAttemptsToday).toBe(14);

    const pagedUsers = normalizePaginatedData(
      {
        items: [{ id: 1, email: 'a@b.com', fullName: 'A', isActive: true, currentStreak: 2 }],
        pagination: { page: 2, limit: 10, total: 25, totalPages: 3 },
      },
      normalizeAdminUserRow,
    );
    expect(pagedUsers.totalPages).toBe(3);
    expect(pagedUsers.items[0].currentStreak).toBe(2);

    const log = normalizeAuditLogEntry({
      id: 1,
      actorUserId: 9,
      action: 'ADMIN_USER_DISABLED',
      targetType: 'user',
      targetId: 4,
      createdAt: '2026-11-24T10:00:00Z',
    });
    expect(log.actorId).toBe(9);
  });
});
