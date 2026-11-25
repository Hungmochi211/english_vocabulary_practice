import { DataSource } from 'typeorm';
import { LearningService } from '../../src/modules/learning/learning.service';
import { DistractorService } from '../../src/modules/algorithm/distractor.service';
import { StratifiedSamplingService } from '../../src/modules/algorithm/stratified-sampling.service';

describe('User Sync & Support Services Unit Suite (US6 — FR-017..FR-020)', () => {
  it('US6-AS3 (History): returns submitted quiz attempts with graded word breakdown isolated by userId', async () => {
    const attempts = [
      {
        id: 42,
        lessonId: 1,
        lessonTitle: 'Greetings & Introductions',
        attemptType: 'lesson_practice',
        totalQuestions: 2,
        totalScore: 1.5,
        scorePercentage: 75,
        startedAt: '2026-11-25T05:00:00.000Z',
        submittedAt: '2026-11-25T05:01:25.000Z',
      },
    ];
    const answers = [
      {
        attemptId: 42,
        vocabularyId: 101,
        word: 'peaceful',
        phonetic: '/ˈpiːsfl/',
        meaning: 'yên bình',
        userAnswer: 'peaceful',
        gradingStatus: 'exact',
      },
      {
        attemptId: 42,
        vocabularyId: 102,
        word: 'phone',
        phonetic: '/fəʊn/',
        meaning: 'điện thoại',
        userAnswer: 'phoen',
        gradingStatus: 'near_match',
      },
    ];

    const dataSourceMock = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('FROM quiz_attempts a')) {
          expect(params?.[0]).toBe(7); // strictly filtered by userId = 7
          return attempts;
        }
        if (sql.includes('SELECT COUNT(*)::int AS total FROM quiz_attempts')) {
          return [{ total: 1 }];
        }
        if (sql.includes('FROM quiz_attempt_answers qa')) {
          expect(params?.[0]).toEqual([42]);
          return answers;
        }
        return [];
      }),
    } as unknown as DataSource;

    const service = new LearningService(
      dataSourceMock,
      {} as DistractorService,
      new StratifiedSamplingService(),
    );

    const res = await service.getHistoryPaginated(7, { page: 1, limit: 20 });
    expect(res.pagination.total).toBe(1);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({
      id: 'attempt-42',
      attemptId: 42,
      type: 'typing',
      title: 'Thực hành Bước 2 — Greetings & Introductions',
      correct: 1,
      total: 2,
      accuracy: 75,
      xp: 15,
      duration: '01:25',
    });
    expect(res.items[0].words).toHaveLength(2);
    expect(res.items[0].words[0].ok).toBe(true);
    expect(res.items[0].words[1].ok).toBe(false);
  });
});
