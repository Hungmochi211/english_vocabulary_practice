import { DataSource } from 'typeorm';
import {
  StreakService,
  computeLeaderboardBadges,
} from '../../src/modules/gamification/streak.service';
import { QuizGradingService } from '../../src/modules/learning/quiz-grading.service';

describe('Weekly Leaderboard Service (Gamification)', () => {
  it('derives badges accurately from rank, streak, weekly XP, and words studied', () => {
    expect(
      computeLeaderboardBadges({
        rank: 1,
        weeklyXp: 3120,
        wordsThisWeek: 120,
        streakDays: 21,
      }),
    ).toEqual(['Top 1 Tuần', 'Bền bỉ 21 ngày', 'Siêng năng']);

    expect(
      computeLeaderboardBadges({
        rank: 2,
        weeklyXp: 850,
        wordsThisWeek: 30,
        streakDays: 7,
      }),
    ).toEqual(['Streak 7+ ngày']);

    expect(
      computeLeaderboardBadges({
        rank: 1,
        weeklyXp: 0,
        wordsThisWeek: 0,
        streakDays: 0,
      }),
    ).toEqual(['Học viên mới']);
  });

  it('returns ranked leaderboard members from PostgreSQL without leaking private fields like email', async () => {
    const queryMock = jest.fn().mockResolvedValue([
      {
        userId: 10,
        fullName: 'Minh Khôi',
        avatarUrl: 'https://cdn.example.com/khoi.png',
        level: 'B2',
        weeklyXp: 3120,
        wordsThisWeek: 148,
        streakDays: 21,
        rank: 1,
        email: 'khoi@secret.vn',
      },
      {
        userId: 5,
        fullName: 'Nguyễn An',
        avatarUrl: null,
        level: 'B1',
        weeklyXp: 1200,
        wordsThisWeek: 55,
        streakDays: 8,
        rank: 2,
        email: 'an@secret.vn',
      },
    ]);

    const mockDataSource = { query: queryMock } as unknown as DataSource;
    const mockGrading = { setStreakRecorder: jest.fn() } as unknown as QuizGradingService;
    const service = new StreakService(mockDataSource, mockGrading);

    const result = await service.getWeeklyLeaderboard(5, 20, new Date('2026-11-27T10:00:00+07:00'));

    expect(queryMock).toHaveBeenCalledTimes(1);
    const [, params] = queryMock.mock.calls[0];
    expect(params[0]).toBe(5); // currentUserId
    expect(params[1]).toBe('2026-11-21'); // weekStartDate (7 days inclusive ending 2026-11-27)
    expect(params[2]).toBe('2026-11-26'); // yesterday UTC+7
    expect(params[3]).toBe(20); // limit

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      userId: '10',
      fullName: 'Minh Khôi',
      avatarUrl: 'https://cdn.example.com/khoi.png',
      level: 'B2',
      weeklyXp: 3120,
      wordsThisWeek: 148,
      streakDays: 21,
      badges: ['Top 1 Tuần', 'Bền bỉ 21 ngày', 'Siêng năng'],
      isCurrentUser: false,
      rank: 1,
    });
    expect(result[1]).toEqual({
      userId: '5',
      fullName: 'Nguyễn An',
      avatarUrl: null,
      level: 'B1',
      weeklyXp: 1200,
      wordsThisWeek: 55,
      streakDays: 8,
      badges: ['Streak 7+ ngày', 'Siêng năng'],
      isCurrentUser: true,
      rank: 2,
    });
    expect('email' in result[0]).toBe(false);
    expect('email' in result[1]).toBe(false);
  });
});
