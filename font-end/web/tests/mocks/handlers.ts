import { http, HttpResponse } from 'msw';
import { stripVietnameseDiacritics } from '@/utils/formatters';
import type {
  AdminSystemStats,
  AdminUserRow,
  AuditLogEntry,
  DueReviewItem,
  GradedAnswerResult,
  GradingStatus,
  LessonDetail,
  LessonProgressItem,
  NotificationItem,
  QuizAttemptStart,
  QuizQuestion,
  QuizSubmitResult,
  SavedWordRecord,
  StatsOverview,
  SupportMessage,
  SupportTicketItem,
  Topic,
  UserProfile,
  VocabularyItem,
} from '@/types/models';

export const API_BASE = 'http://localhost:3000/api/v1';

export const mockLearnerUser: UserProfile = {
  id: 1,
  email: 'nguyenan@vnua.edu.vn',
  fullName: 'Nguyễn An',
  avatarUrl: null,
  role: 'learner',
  targetLevel: 'B2',
  emailReminderEnabled: true,
  isActive: true,
  createdAt: '2026-11-01T00:00:00.000Z',
};

export const mockAdminUser: UserProfile = {
  id: 99,
  email: 'admin@lexitag.vn',
  fullName: 'Quản trị viên',
  avatarUrl: null,
  role: 'admin',
  targetLevel: 'B2',
  emailReminderEnabled: false,
  isActive: true,
  createdAt: '2026-10-01T00:00:00.000Z',
};

export const mockTopics: Topic[] = [
  { id: 1, name: 'Daily Life', slug: 'daily-life', description: 'Giao tiếp hằng ngày', lessonCount: 2 },
  { id: 2, name: 'Environment', slug: 'environment', description: 'Môi trường & thiên nhiên', lessonCount: 1 },
  { id: 3, name: 'Technology', slug: 'technology', description: 'Công nghệ & số hóa', lessonCount: 1 },
];

export const mockVocabularies: VocabularyItem[] = [
  {
    id: 101,
    word: 'peaceful',
    cefrLevel: 'A1',
    partOfSpeech: 'adj',
    phonetic: '/ˈpiːsfl/',
    vietnameseMeaning: 'yên bình, thanh bình',
    exampleEn: 'The village looks very peaceful in the early morning.',
    exampleVi: 'Ngôi làng trông thật yên bình vào sáng sớm.',
    topicId: 1,
    topicName: 'Daily Life',
    audioUrl: null,
  },
  {
    id: 102,
    word: 'phone',
    cefrLevel: 'A1',
    partOfSpeech: 'n, v',
    phonetic: '/fəʊn/',
    vietnameseMeaning: 'điện thoại; gọi điện',
    exampleEn: 'Please phone me when you arrive at the station.',
    exampleVi: 'Hãy gọi điện cho tôi khi bạn đến nhà ga.',
    topicId: 1,
    topicName: 'Daily Life',
    audioUrl: null,
  },
  {
    id: 103,
    word: 'go',
    cefrLevel: 'A1',
    partOfSpeech: 'v, n',
    phonetic: '/ɡəʊ/',
    vietnameseMeaning: 'đi, di chuyển',
    exampleEn: 'We go to the library together every afternoon.',
    exampleVi: 'Chúng tôi cùng nhau đi đến thư viện mỗi buổi chiều.',
    topicId: 1,
    topicName: 'Daily Life',
    audioUrl: null,
  },
  {
    id: 201,
    word: 'morning',
    cefrLevel: 'A1',
    partOfSpeech: 'n',
    phonetic: '/ˈmɔːnɪŋ/',
    vietnameseMeaning: 'buổi sáng',
    exampleEn: 'She drinks green tea every morning.',
    exampleVi: 'Cô ấy uống trà xanh vào mỗi buổi sáng.',
    topicId: 1,
    topicName: 'Daily Life',
    audioUrl: null,
  },
  {
    id: 202,
    word: 'in',
    cefrLevel: 'A1',
    partOfSpeech: 'prep, adv',
    phonetic: '/ɪn/',
    vietnameseMeaning: 'ở trong, bên trong',
    exampleEn: 'The notebook is in my backpack.',
    exampleVi: 'Quyển vở nằm ở trong ba lô của tôi.',
    topicId: 1,
    topicName: 'Daily Life',
    audioUrl: null,
  },
  {
    id: 203,
    word: 'coffee',
    cefrLevel: 'A1',
    partOfSpeech: 'n',
    phonetic: '/ˈkɒfi/',
    vietnameseMeaning: 'cà phê',
    exampleEn: 'A warm cup of coffee helps me focus.',
    exampleVi: 'Một tách cà phê ấm giúp tôi tập trung.',
    topicId: 1,
    topicName: 'Daily Life',
    audioUrl: null,
  },
  {
    id: 301,
    word: 'environment',
    cefrLevel: 'B1',
    partOfSpeech: 'n',
    phonetic: '/ɪnˈvaɪrənmənt/',
    vietnameseMeaning: 'môi trường',
    exampleEn: 'Everyone should help protect the environment.',
    exampleVi: 'Mọi người đều nên góp phần bảo vệ môi trường.',
    topicId: 2,
    topicName: 'Environment',
    audioUrl: null,
  },
  {
    id: 302,
    word: 'recycle',
    cefrLevel: 'B1',
    partOfSpeech: 'v',
    phonetic: '/ˌriːˈsaɪkl/',
    vietnameseMeaning: 'tái chế',
    exampleEn: 'We recycle plastic bottles and paper at school.',
    exampleVi: 'Chúng tôi tái chế chai nhựa và giấy ở trường.',
    topicId: 2,
    topicName: 'Environment',
    audioUrl: null,
  },
];

interface StoredAttempt {
  attemptId: number;
  attemptType: 'lesson_practice' | 'sm2_review' | 'mixed_quiz';
  lessonId?: number;
  questions: QuizQuestion[];
  submitted: boolean;
}

interface MockDbState {
  user: UserProfile;
  stats: StatsOverview;
  lessons: LessonProgressItem[];
  lessonVocabIds: Record<number, number[]>;
  openedByLesson: Record<number, number[]>;
  dueItems: DueReviewItem[];
  nextAttemptId: number;
  attempts: Record<number, StoredAttempt>;
  adminUsers: AdminUserRow[];
  adminStats: AdminSystemStats;
  auditLogs: AuditLogEntry[];
}

function createInitialMockDb(): MockDbState {
  return {
    user: { ...mockLearnerUser },
    adminUsers: [
      {
        id: 1,
        email: 'nguyenan@vnua.edu.vn',
        fullName: 'Nguyễn An',
        role: 'learner',
        targetLevel: 'B2',
        isActive: true,
        currentStreak: 7,
        createdAt: '2026-11-01T08:00:00.000Z',
      },
      {
        id: 2,
        email: 'minhkhoi@vnua.edu.vn',
        fullName: 'Minh Khôi',
        role: 'learner',
        targetLevel: 'B1',
        isActive: true,
        currentStreak: 21,
        createdAt: '2026-11-02T09:15:00.000Z',
      },
      {
        id: 3,
        email: 'thuha@vnua.edu.vn',
        fullName: 'Thu Hà',
        role: 'learner',
        targetLevel: 'A2',
        isActive: false,
        currentStreak: 0,
        createdAt: '2026-11-03T10:30:00.000Z',
      },
    ],
    adminStats: {
      totalUsers: 1248,
      activeUsersToday: 312,
      totalVocabularyCount: 3813,
      totalAttemptsToday: 964,
    },
    auditLogs: [
      {
        id: 501,
        actorId: 99,
        actorEmail: 'admin@lexitag.vn',
        action: 'USER_STATUS_CHANGED',
        targetType: 'user',
        targetId: 3,
        createdAt: '2026-11-22T14:20:00.000Z',
        metadata: { isActive: false },
      },
      {
        id: 502,
        actorId: 99,
        actorEmail: 'admin@lexitag.vn',
        action: 'VOCABULARY_SYNCED',
        targetType: 'vocabulary',
        targetId: 'oxford-3000',
        createdAt: '2026-11-21T09:00:00.000Z',
      },
    ],
    stats: {
      currentStreak: 7,
      longestStreak: 14,
      completedToday: false,
      totalXp: 2450,
      learnedWordsCount: 428,
      dueReviewsCount: 3,
      leitnerDistribution: { box1: 2, box2: 1, box3: 4, box4: 5, box5: 6 },
      last7Days: [
        { date: '2026-11-17', wordsStudied: 12, reviewsCompleted: 10, xpEarned: 120, completedGoal: true },
        { date: '2026-11-18', wordsStudied: 15, reviewsCompleted: 8, xpEarned: 145, completedGoal: true },
        { date: '2026-11-19', wordsStudied: 10, reviewsCompleted: 12, xpEarned: 130, completedGoal: true },
        { date: '2026-11-20', wordsStudied: 18, reviewsCompleted: 15, xpEarned: 190, completedGoal: true },
        { date: '2026-11-21', wordsStudied: 14, reviewsCompleted: 9, xpEarned: 140, completedGoal: true },
        { date: '2026-11-22', wordsStudied: 16, reviewsCompleted: 11, xpEarned: 165, completedGoal: true },
        { date: '2026-11-23', wordsStudied: 8, reviewsCompleted: 0, xpEarned: 60, completedGoal: false },
      ],
    },
    lessons: [
      {
        lessonId: 1,
        title: 'Daily Routines & Peace',
        cefrLevel: 'A1',
        topicId: 1,
        topicName: 'Daily Life',
        orderIndex: 1,
        wordCount: 3,
        openedCount: 0,
        isUnlocked: true,
        acquisitionCompleted: false,
        isCompleted: false,
        bestScore: null,
      },
      {
        lessonId: 2,
        title: 'Morning Habits',
        cefrLevel: 'A1',
        topicId: 1,
        topicName: 'Daily Life',
        orderIndex: 2,
        wordCount: 3,
        openedCount: 0,
        isUnlocked: false,
        acquisitionCompleted: false,
        isCompleted: false,
        bestScore: null,
      },
      {
        lessonId: 3,
        title: 'Green Planet Basics',
        cefrLevel: 'B1',
        topicId: 2,
        topicName: 'Environment',
        orderIndex: 3,
        wordCount: 2,
        openedCount: 0,
        isUnlocked: false,
        acquisitionCompleted: false,
        isCompleted: false,
        bestScore: null,
      },
    ],
    lessonVocabIds: {
      1: [101, 102, 103],
      2: [201, 202, 203],
      3: [301, 302],
    },
    openedByLesson: {
      1: [],
      2: [],
      3: [],
    },
    dueItems: [
      {
        vocabularyId: 101,
        word: 'peaceful',
        phonetic: '/ˈpiːsfl/',
        partOfSpeech: 'adj',
        cefrLevel: 'A1',
        vietnameseMeaning: 'yên bình, thanh bình',
        exampleEn: 'The village looks very peaceful in the early morning.',
        exampleVi: 'Ngôi làng trông thật yên bình vào sáng sớm.',
        audioUrl: null,
        leitnerBox: 1,
        nextReviewDate: '2026-11-23',
      },
      {
        vocabularyId: 102,
        word: 'phone',
        phonetic: '/fəʊn/',
        partOfSpeech: 'n, v',
        cefrLevel: 'A1',
        vietnameseMeaning: 'điện thoại; gọi điện',
        exampleEn: 'Please phone me when you arrive at the station.',
        exampleVi: 'Hãy gọi điện cho tôi khi bạn đến nhà ga.',
        audioUrl: null,
        leitnerBox: 1,
        nextReviewDate: '2026-11-23',
      },
      {
        vocabularyId: 103,
        word: 'go',
        phonetic: '/ɡəʊ/',
        partOfSpeech: 'v, n',
        cefrLevel: 'A1',
        vietnameseMeaning: 'đi, di chuyển',
        exampleEn: 'We go to the library together every afternoon.',
        exampleVi: 'Chúng tôi cùng nhau đi đến thư viện mỗi buổi chiều.',
        audioUrl: null,
        leitnerBox: 2,
        nextReviewDate: '2026-11-23',
      },
    ],
    nextAttemptId: 500,
    attempts: {},
  };
}

let mockDb: MockDbState = createInitialMockDb();

export function resetMockDb(): void {
  mockDb = createInitialMockDb();
  mockPasswordResetOtps.clear();
  mockServerHistory.length = 0;
  mockServerSavedWords.length = 0;
  mockServerNotifications.length = 0;
  mockServerSupportMessages.length = 0;
  mockServerSupportTickets.length = 0;
  nextNotifId = 1;
  nextSupportMsgId = 1;
  nextSupportTicketId = 1;
}

let nextNotifId = 1;
let nextSupportMsgId = 1;
let nextSupportTicketId = 1;
const mockPasswordResetOtps = new Map<string, { otp: string; attempts: number }>();
const mockServerSavedWords: SavedWordRecord[] = [];
const mockServerNotifications: NotificationItem[] = [];
const mockServerSupportMessages: SupportMessage[] = [];
const mockServerSupportTickets: SupportTicketItem[] = [];
const mockServerHistory: Array<{
  id: string;
  attemptId: number;
  type: 'study' | 'pronunciation' | 'srs' | 'quiz' | 'typing' | 'dictation';
  title: string;
  correct: number;
  total: number;
  accuracy: number;
  xp: number;
  duration: string;
  createdAt: string;
  words: Array<{
    vocabularyId: number;
    word: string;
    phonetic?: string;
    meaning?: string;
    userAnswer?: string | null;
    gradingStatus?: GradingStatus;
    ok: boolean;
  }>;
}> = [];

export function getMockPasswordResetOtp(email: string): string | null {
  return mockPasswordResetOtps.get(email.trim().toLowerCase())?.otp ?? null;
}

export function setMockDueEmpty(): void {
  mockDb.dueItems = [];
  mockDb.stats.dueReviewsCount = 0;
}

export function setMockTotalXp(totalXp: number): void {
  mockDb.stats.totalXp = totalXp;
}

function damerauLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

function phoneticKey(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/gh/g, '');
  if (!s) return '';
  const map: Record<string, string> = {
    b: '1', f: '1', p: '1', v: '1',
    c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
    d: '3', t: '3',
    l: '4',
    m: '5', n: '5',
    r: '6',
  };
  let code = s[0];
  let prev = map[s[0]] || '';
  for (let i = 1; i < s.length; i += 1) {
    const digit = map[s[i]] || '';
    if (digit && digit !== prev) {
      code += digit;
    }
    prev = digit;
  }
  return code.padEnd(4, '0').slice(0, 4);
}

function gradeBackendAnswer(
  vocab: VocabularyItem,
  mode: QuizQuestion['practiceMode'],
  rawAnswer: string | null,
): { gradingStatus: GradingStatus; pointsAwarded: number; feedbackMessage: string } {
  const normalized = (rawAnswer ?? '').trim().toLowerCase();
  if (!normalized) {
    return {
      gradingStatus: 'incorrect',
      pointsAwarded: 0,
      feedbackMessage: `Chưa chính xác. Đáp án đúng là "${vocab.word}".`,
    };
  }

  if (mode === 'multiple_choice') {
    const expectedMeaning = vocab.vietnameseMeaning.trim().toLowerCase();
    const expectedWord = vocab.word.trim().toLowerCase();
    if (normalized === expectedMeaning || normalized === expectedWord) {
      return {
        gradingStatus: 'exact',
        pointsAwarded: 1,
        feedbackMessage: 'Chính xác tuyệt đối!',
      };
    }
    return {
      gradingStatus: 'incorrect',
      pointsAwarded: 0,
      feedbackMessage: `Chưa chính xác. Nghĩa đúng là "${vocab.vietnameseMeaning}".`,
    };
  }

  const target = vocab.word.trim().toLowerCase();
  if (normalized === target) {
    return {
      gradingStatus: 'exact',
      pointsAwarded: 1,
      feedbackMessage: 'Chính xác tuyệt đối!',
    };
  }

  // 002-backend-core rule: near_match ONLY applies when target word length >= 3
  if (target.length >= 3 && damerauLevenshtein(normalized, target) === 1) {
    return {
      gradingStatus: 'near_match',
      pointsAwarded: 0.5,
      feedbackMessage: `Gần đúng! Chú ý chính tả của "${vocab.word}".`,
    };
  }

  if (target.length >= 3 && phoneticKey(normalized) === phoneticKey(target)) {
    return {
      gradingStatus: 'phonetic_match',
      pointsAwarded: 0,
      feedbackMessage: `Đúng âm nhưng sai mặt chữ. Cách viết đúng là "${vocab.word}".`,
    };
  }

  return {
    gradingStatus: 'incorrect',
    pointsAwarded: 0,
    feedbackMessage: `Chưa chính xác. Đáp án đúng là "${vocab.word}".`,
  };
}

function buildOptionsForVocab(vocab: VocabularyItem): string[] {
  const distractors = mockVocabularies
    .filter((item) => item.id !== vocab.id)
    .slice(0, 3)
    .map((item) => item.vietnameseMeaning);
  return [vocab.vietnameseMeaning, ...distractors];
}

function buildQuestion(vocab: VocabularyItem, mode: QuizQuestion['practiceMode']): QuizQuestion {
  const masked = vocab.exampleEn.replace(new RegExp(`\\b${vocab.word}\\b`, 'i'), '_____');
  return {
    vocabularyId: vocab.id,
    practiceMode: mode,
    prompt: {
      word: mode === 'multiple_choice' ? vocab.word : undefined,
      phonetic: vocab.phonetic,
      partOfSpeech: vocab.partOfSpeech,
      cefrLevel: vocab.cefrLevel,
      vietnameseMeaning: vocab.vietnameseMeaning,
      clozeExampleEn: masked,
      audioUrl: vocab.audioUrl,
      options: mode === 'multiple_choice' ? buildOptionsForVocab(vocab) : undefined,
    },
  };
}

export const handlers = [
  http.post(`${API_BASE}/auth/register`, async ({ request }) => {
    const body = (await request.json()) as { fullName?: string; email?: string; password?: string };
    if (!body.email || !body.password || body.password.length < 8) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Thông tin đăng ký chưa hợp lệ.',
            details: null,
          },
        },
        { status: 400 },
      );
    }
    const user: UserProfile = {
      ...mockLearnerUser,
      id: 2,
      fullName: body.fullName?.trim() || 'Học viên mới',
      email: body.email.trim(),
    };
    return HttpResponse.json(
      {
        success: true,
        data: {
          accessToken: 'mock-access-token-register',
          refreshToken: 'mock-refresh-token-register',
          expiresInSeconds: 900,
          user,
        },
        error: null,
      },
      { status: 201 },
    );
  }),

  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (body.email === 'locked@vnua.edu.vn') {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'Tài khoản của bạn đã bị tạm khóa. Vui lòng liên hệ Quản trị viên.',
            details: null,
          },
        },
        { status: 403 },
      );
    }
    if (body.email === mockAdminUser.email && body.password === 'Admin1234!') {
      return HttpResponse.json({
        success: true,
        data: {
          accessToken: 'mock-access-admin',
          refreshToken: 'mock-refresh-admin',
          expiresInSeconds: 900,
          user: mockAdminUser,
        },
        error: null,
      });
    }
    if (body.email === mockLearnerUser.email && body.password === 'Password123!') {
      return HttpResponse.json({
        success: true,
        data: {
          accessToken: 'mock-access-learner',
          refreshToken: 'mock-refresh-learner',
          expiresInSeconds: 900,
          user: mockLearnerUser,
        },
        error: null,
      });
    }
    return HttpResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Email hoặc mật khẩu không chính xác.',
          details: null,
        },
      },
      { status: 401 },
    );
  }),

  http.post(`${API_BASE}/auth/google`, async ({ request }) => {
    const body = (await request.json()) as { idToken?: string };
    if (!body.idToken) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Mã xác thực Google không hợp lệ.',
            details: null,
          },
        },
        { status: 401 },
      );
    }
    return HttpResponse.json({
      success: true,
      data: {
        accessToken: 'mock-access-google',
        refreshToken: 'mock-refresh-google',
        expiresInSeconds: 900,
        user: {
          ...mockLearnerUser,
          avatarUrl: 'https://example.com/google-avatar.png',
        },
      },
      error: null,
    });
  }),

  http.post(`${API_BASE}/auth/refresh`, async () => {
    return HttpResponse.json({
      success: true,
      data: {
        accessToken: 'mock-access-refreshed',
        refreshToken: 'mock-refresh-rotated',
        expiresInSeconds: 900,
        user: mockLearnerUser,
      },
      error: null,
    });
  }),

  http.post(`${API_BASE}/auth/logout`, async () => {
    return HttpResponse.json({
      success: true,
      data: null,
      error: null,
    });
  }),

  http.post(`${API_BASE}/auth/change-password`, async ({ request }) => {
    const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
    if (body.currentPassword !== 'Password123!') {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INVALID_CURRENT_PASSWORD',
            message: 'Mật khẩu hiện tại không chính xác.',
            details: null,
          },
        },
        { status: 400 },
      );
    }
    if (!body.newPassword || body.newPassword.length < 8) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Mật khẩu mới phải có ít nhất 8 ký tự.',
            details: null,
          },
        },
        { status: 400 },
      );
    }
    return HttpResponse.json({
      success: true,
      data: null,
      error: null,
    });
  }),

  http.get(`${API_BASE}/users/me`, async () => {
    return HttpResponse.json({
      success: true,
      data: mockDb.user,
      error: null,
    });
  }),

  http.patch(`${API_BASE}/users/me`, async ({ request }) => {
    const patch = (await request.json()) as Partial<UserProfile>;
    if (typeof patch.avatarUrl === 'string' && patch.avatarUrl.length > 500) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'avatarUrl không được vượt quá 500 ký tự (hãy dùng POST /users/me/avatar để tải ảnh).',
            details: null,
          },
        },
        { status: 400 },
      );
    }
    mockDb.user = {
      ...mockDb.user,
      ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
      ...(patch.avatarUrl !== undefined ? { avatarUrl: patch.avatarUrl } : {}),
      ...(patch.targetLevel !== undefined ? { targetLevel: patch.targetLevel } : {}),
      ...(patch.emailReminderEnabled !== undefined
        ? { emailReminderEnabled: patch.emailReminderEnabled }
        : {}),
    };
    return HttpResponse.json({
      success: true,
      data: mockDb.user,
      error: null,
    });
  }),

  http.get(`${API_BASE}/stats/overview`, async () => {
    return HttpResponse.json({
      success: true,
      data: mockDb.stats,
      error: null,
    });
  }),

  http.get(`${API_BASE}/topics`, async () => {
    return HttpResponse.json({
      success: true,
      data: mockTopics,
      error: null,
    });
  }),

  http.get(`${API_BASE}/lessons`, async ({ request }) => {
    const url = new URL(request.url);
    const level = url.searchParams.get('level');
    const topicId = url.searchParams.get('topicId');
    let items = [...mockDb.lessons];
    if (level) items = items.filter((l) => l.cefrLevel === level);
    if (topicId) items = items.filter((l) => l.topicId === Number(topicId));
    return HttpResponse.json({
      success: true,
      data: {
        items,
        page: 1,
        limit: 20,
        total: items.length,
        totalPages: 1,
      },
      error: null,
    });
  }),

  http.get(`${API_BASE}/lessons/:id`, async ({ params }) => {
    const lessonId = Number(params.id);
    const lesson = mockDb.lessons.find((l) => l.lessonId === lessonId);
    if (!lesson) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: 'Không tìm thấy bài học.', details: null },
        },
        { status: 404 },
      );
    }
    const vocabIds = mockDb.lessonVocabIds[lessonId] ?? [];
    const vocabularies = vocabIds
      .map((vid) => mockVocabularies.find((v) => v.id === vid))
      .filter((v): v is VocabularyItem => Boolean(v));
    const detail: LessonDetail = {
      id: lesson.lessonId,
      title: lesson.title,
      cefrLevel: lesson.cefrLevel,
      topicId: lesson.topicId,
      topicName: lesson.topicName,
      orderIndex: lesson.orderIndex,
      wordCount: lesson.wordCount,
      openedVocabularyIds: [...(mockDb.openedByLesson[lessonId] ?? [])],
      vocabularies,
    };
    return HttpResponse.json({
      success: true,
      data: detail,
      error: null,
    });
  }),

  http.get(`${API_BASE}/vocabularies/search`, async ({ request }) => {
    const url = new URL(request.url);
    const q = stripVietnameseDiacritics((url.searchParams.get('q') ?? '').trim());
    const level = url.searchParams.get('level');
    const pos = (url.searchParams.get('partOfSpeech') ?? '').trim().toLowerCase();
    const topicId = url.searchParams.get('topicId');
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const limit = Math.max(1, Number(url.searchParams.get('limit') ?? 20));
    let items = [...mockVocabularies];
    if (q) {
      items = items.filter((v) => {
        const wordNorm = stripVietnameseDiacritics(v.word);
        const meaningNorm = stripVietnameseDiacritics(v.vietnameseMeaning);
        return wordNorm.includes(q) || meaningNorm.includes(q);
      });
    }
    if (level) items = items.filter((v) => v.cefrLevel === level);
    if (pos) {
      items = items.filter((v) =>
        v.partOfSpeech
          .toLowerCase()
          .split(',')
          .map((p) => p.trim())
          .includes(pos),
      );
    }
    if (topicId) items = items.filter((v) => v.topicId === Number(topicId));
    const start = (page - 1) * limit;
    const paged = items.slice(start, start + limit);
    return HttpResponse.json({
      success: true,
      data: {
        items: paged,
        page,
        limit,
        total: items.length,
        totalPages: Math.max(1, Math.ceil(items.length / limit)),
      },
      error: null,
    });
  }),

  http.get(`${API_BASE}/vocabularies/saved`, async () => {
    return HttpResponse.json({
      success: true,
      data: [...mockServerSavedWords],
      error: null,
    });
  }),

  http.get(`${API_BASE}/vocabularies/:id`, async ({ params }) => {
    const vocab = mockVocabularies.find((v) => v.id === Number(params.id));
    if (!vocab) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: 'Không tìm thấy từ vựng.', details: null },
        },
        { status: 404 },
      );
    }
    return HttpResponse.json({
      success: true,
      data: vocab,
      error: null,
    });
  }),

  http.get(`${API_BASE}/learning/lessons`, async ({ request }) => {
    const url = new URL(request.url);
    const level = url.searchParams.get('level');
    const topicId = url.searchParams.get('topicId');
    let items = [...mockDb.lessons];
    if (level) items = items.filter((l) => l.cefrLevel === level);
    if (topicId) items = items.filter((l) => l.topicId === Number(topicId));
    return HttpResponse.json({
      success: true,
      data: items,
      error: null,
    });
  }),

  http.post(`${API_BASE}/learning/lessons/:lessonId/cards/:vocabularyId/open`, async ({ params }) => {
    const lessonId = Number(params.lessonId);
    const vocabularyId = Number(params.vocabularyId);
    const lesson = mockDb.lessons.find((l) => l.lessonId === lessonId);
    if (!lesson) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: 'Không tìm thấy bài học.', details: null },
        },
        { status: 404 },
      );
    }
    if (!lesson.isUnlocked) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'LESSON_LOCKED',
            message: 'Bạn cần hoàn thành bài học trước đạt từ 80% trở lên để mở khóa bài này.',
            details: null,
          },
        },
        { status: 403 },
      );
    }
    const opened = mockDb.openedByLesson[lessonId] ?? [];
    if (!opened.includes(vocabularyId)) {
      opened.push(vocabularyId);
      mockDb.openedByLesson[lessonId] = opened;
    }
    lesson.openedCount = opened.length;
    lesson.acquisitionCompleted = lesson.openedCount >= lesson.wordCount;
    return HttpResponse.json({
      success: true,
      data: lesson,
      error: null,
    });
  }),

  http.post(`${API_BASE}/learning/lessons/:lessonId/practice/start`, async ({ params }) => {
    const lessonId = Number(params.lessonId);
    const lesson = mockDb.lessons.find((l) => l.lessonId === lessonId);
    if (!lesson) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: 'Không tìm thấy bài học.', details: null },
        },
        { status: 404 },
      );
    }
    if (!lesson.isUnlocked) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'LESSON_LOCKED',
            message: 'Bài học này chưa được mở khóa.',
            details: null,
          },
        },
        { status: 403 },
      );
    }
    if (!lesson.acquisitionCompleted) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'ACQUISITION_REQUIRED',
            message: 'Vui lòng mở đủ 100% thẻ từ ở Bước 1 trước khi làm Thực hành Bước 2.',
            details: null,
          },
        },
        { status: 403 },
      );
    }

    const vocabIds = mockDb.lessonVocabIds[lessonId] ?? [];
    const vocabs = vocabIds
      .map((id) => mockVocabularies.find((v) => v.id === id))
      .filter((v): v is VocabularyItem => Boolean(v));

    const questions: QuizQuestion[] = vocabs.map((v, idx) =>
      buildQuestion(v, idx === 0 ? 'typing' : idx === 1 ? 'dictation' : 'typing'),
    );

    const attemptId = mockDb.nextAttemptId++;
    mockDb.attempts[attemptId] = {
      attemptId,
      attemptType: 'lesson_practice',
      lessonId,
      questions,
      submitted: false,
    };

    const response: QuizAttemptStart = {
      attemptId,
      attemptType: 'lesson_practice',
      totalQuestions: questions.length,
      questions,
    };

    return HttpResponse.json({
      success: true,
      data: response,
      error: null,
    });
  }),

  http.get(`${API_BASE}/reviews/due`, async () => {
    return HttpResponse.json({
      success: true,
      data: {
        dueCount: mockDb.dueItems.length,
        leitnerDistribution: mockDb.stats.leitnerDistribution,
        items: mockDb.dueItems,
      },
      error: null,
    });
  }),

  http.post(`${API_BASE}/reviews/session/start`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const limit = Math.max(1, Math.min(50, body.limit ?? 20));
    const slice = mockDb.dueItems.slice(0, limit);
    const questions: QuizQuestion[] = slice
      .map((due) => mockVocabularies.find((v) => v.id === due.vocabularyId))
      .filter((v): v is VocabularyItem => Boolean(v))
      .map((vocab) => buildQuestion(vocab, 'typing'));

    const attemptId = mockDb.nextAttemptId++;
    mockDb.attempts[attemptId] = {
      attemptId,
      attemptType: 'sm2_review',
      questions,
      submitted: false,
    };

    const response: QuizAttemptStart = {
      attemptId,
      attemptType: 'sm2_review',
      totalQuestions: questions.length,
      questions,
    };

    return HttpResponse.json({
      success: true,
      data: response,
      error: null,
    });
  }),

  http.post(`${API_BASE}/learning/quizzes/mixed/start`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as { totalQuestions?: number };
    const count = Math.max(1, Math.min(40, body.totalQuestions ?? 5));
    const pool = mockVocabularies.slice(0, Math.min(count, mockVocabularies.length));
    const modes: QuizQuestion['practiceMode'][] = ['multiple_choice', 'typing', 'dictation'];
    const questions: QuizQuestion[] = pool.map((vocab, idx) => buildQuestion(vocab, modes[idx % modes.length]));

    const attemptId = mockDb.nextAttemptId++;
    mockDb.attempts[attemptId] = {
      attemptId,
      attemptType: 'mixed_quiz',
      questions,
      submitted: false,
    };

    const response: QuizAttemptStart = {
      attemptId,
      attemptType: 'mixed_quiz',
      totalQuestions: questions.length,
      questions,
    };

    return HttpResponse.json({
      success: true,
      data: response,
      error: null,
    });
  }),

  http.post(`${API_BASE}/learning/quizzes/:attemptId/submit`, async ({ params, request }) => {
    const attemptId = Number(params.attemptId);
    const attempt = mockDb.attempts[attemptId];
    if (!attempt) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: 'Không tìm thấy phiên làm bài.', details: null },
        },
        { status: 404 },
      );
    }
    if (attempt.submitted) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'ATTEMPT_ALREADY_SUBMITTED',
            message: 'Phiên làm bài này đã được nộp và chấm điểm trước đó.',
            details: null,
          },
        },
        { status: 409 },
      );
    }

    const body = (await request.json()) as {
      answers: Array<{ vocabularyId: number; userAnswer: string | null; responseTimeMs: number }>;
    };

    attempt.submitted = true;

    let totalPoints = 0;
    let exactCount = 0;
    const results: GradedAnswerResult[] = attempt.questions.map((question) => {
      const submission = body.answers.find((a) => a.vocabularyId === question.vocabularyId);
      const vocab = mockVocabularies.find((v) => v.id === question.vocabularyId)!;
      const graded = gradeBackendAnswer(vocab, question.practiceMode, submission?.userAnswer ?? null);
      totalPoints += graded.pointsAwarded;
      if (graded.gradingStatus === 'exact') exactCount += 1;

      const currentDue = mockDb.dueItems.find((d) => d.vocabularyId === vocab.id);
      const currentBox = currentDue?.leitnerBox ?? 1;
      const nextBox = (
        graded.gradingStatus === 'exact'
          ? Math.min(5, currentBox + 1)
          : graded.gradingStatus === 'near_match'
            ? currentBox
            : 1
      ) as 1 | 2 | 3 | 4 | 5;

      return {
        vocabularyId: vocab.id,
        word: vocab.word,
        phonetic: vocab.phonetic,
        vietnameseMeaning: vocab.vietnameseMeaning,
        userAnswer: submission?.userAnswer ?? null,
        gradingStatus: graded.gradingStatus,
        pointsAwarded: graded.pointsAwarded,
        feedbackMessage: graded.feedbackMessage,
        newLeitnerBox: nextBox,
        nextReviewDate: nextBox === 1 ? '2026-11-24' : '2026-11-27',
      };
    });

    const totalQuestions = Math.max(1, attempt.questions.length);
    const scorePercent = Math.round((totalPoints / totalQuestions) * 100);
    const passed = scorePercent >= 80;
    const xpEarned = Math.max(10, Math.round(totalPoints * 20) + (passed ? 30 : 0));

    let nextLessonUnlockedId: number | null = null;
    if (attempt.attemptType === 'lesson_practice' && attempt.lessonId) {
      const currentLesson = mockDb.lessons.find((l) => l.lessonId === attempt.lessonId);
      if (currentLesson) {
        currentLesson.bestScore =
          currentLesson.bestScore === null ? scorePercent : Math.max(currentLesson.bestScore, scorePercent);
        if (passed) {
          currentLesson.isCompleted = true;
          const nextLesson = mockDb.lessons.find((l) => l.orderIndex === currentLesson.orderIndex + 1);
          if (nextLesson && !nextLesson.isUnlocked) {
            nextLesson.isUnlocked = true;
            nextLessonUnlockedId = nextLesson.lessonId;
          }
        }
      }
    }

    if (attempt.attemptType === 'sm2_review') {
      const answeredIds = new Set(results.map((r) => r.vocabularyId));
      mockDb.dueItems = mockDb.dueItems.filter((d) => !answeredIds.has(d.vocabularyId));
      mockDb.stats.dueReviewsCount = mockDb.dueItems.length;
      if (exactCount > 0) {
        mockDb.stats.leitnerDistribution = {
          ...mockDb.stats.leitnerDistribution,
          box1: Math.max(0, mockDb.stats.leitnerDistribution.box1 - exactCount),
          box2: mockDb.stats.leitnerDistribution.box2 + exactCount,
        };
      }
    }

    mockDb.stats.totalXp += xpEarned;
    if (!mockDb.stats.completedToday) {
      mockDb.stats.completedToday = true;
      mockDb.stats.currentStreak += 1;
    }

    const submitResult: QuizSubmitResult = {
      attemptId,
      origin: 'server_official',
      scorePercent,
      passed,
      correctCount: exactCount,
      totalQuestions,
      xpEarned,
      nextLessonUnlockedId,
      streakUpdated: {
        currentStreak: mockDb.stats.currentStreak,
        completedToday: mockDb.stats.completedToday,
      },
      results,
    };

    const lessonTitle = attempt.lessonId
      ? mockDb.lessons.find((l) => l.lessonId === attempt.lessonId)?.title
      : undefined;
    mockServerHistory.unshift({
      id: `attempt-${attemptId}`,
      attemptId,
      type:
        attempt.attemptType === 'sm2_review'
          ? 'srs'
          : attempt.attemptType === 'mixed_quiz'
            ? 'quiz'
            : 'typing',
      title:
        attempt.attemptType === 'sm2_review'
          ? 'Phiên ôn tập SM-2 chính thức'
          : attempt.attemptType === 'mixed_quiz'
            ? 'Bài kiểm tra tổng hợp (Mixed Quiz)'
            : `Thực hành Bước 2 — ${lessonTitle || `Bài #${attempt.lessonId ?? 1}`}`,
      correct: exactCount,
      total: totalQuestions,
      accuracy: scorePercent,
      xp: xpEarned,
      duration: '01:00',
      createdAt: new Date().toISOString(),
      words: results.map((r) => ({
        vocabularyId: r.vocabularyId,
        word: r.word,
        phonetic: r.phonetic,
        meaning: r.vietnameseMeaning,
        userAnswer: r.userAnswer,
        gradingStatus: r.gradingStatus,
        ok: r.gradingStatus === 'exact',
      })),
    });

    if (attempt.attemptType === 'lesson_practice') {
      mockServerNotifications.unshift({
        id: String(nextNotifId++),
        title: passed ? 'Đạt Thực hành Bước 2!' : 'Hoàn tất Thực hành Bước 2',
        body: passed
          ? `Bạn đạt ${scorePercent}% (+${xpEarned} XP) và mở khóa bài kế tiếp.`
          : `Bạn đạt ${scorePercent}%. Ôn lại các từ sai để vượt ngưỡng 80% nhé.`,
        icon: 'trophy',
        tone: passed ? 'green' : 'amber',
        targetRoute: '/history',
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    return HttpResponse.json({
      success: true,
      data: submitResult,
      error: null,
    });
  }),

  http.get(`${API_BASE}/admin/stats`, async () => {
    return HttpResponse.json({
      success: true,
      data: mockDb.adminStats,
      error: null,
    });
  }),

  http.get(`${API_BASE}/admin/users`, async ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const limit = Math.max(1, Number(url.searchParams.get('limit') ?? 10));
    let items = [...mockDb.adminUsers];
    if (q) {
      items = items.filter(
        (u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }
    const start = (page - 1) * limit;
    const paged = items.slice(start, start + limit);
    return HttpResponse.json({
      success: true,
      data: {
        items: paged,
        page,
        limit,
        total: items.length,
        totalPages: Math.max(1, Math.ceil(items.length / limit)),
      },
      error: null,
    });
  }),

  http.patch(`${API_BASE}/admin/users/:userId/status`, async ({ params, request }) => {
    const userId = Number(params.userId);
    const body = (await request.json()) as { isActive: boolean };
    const target = mockDb.adminUsers.find((u) => u.id === userId);
    if (!target) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài khoản.', details: null },
        },
        { status: 404 },
      );
    }
    target.isActive = Boolean(body.isActive);
    mockDb.auditLogs.unshift({
      id: Date.now(),
      actorId: mockAdminUser.id,
      actorEmail: mockAdminUser.email,
      action: target.isActive ? 'USER_UNLOCKED' : 'USER_LOCKED',
      targetType: 'user',
      targetId: target.id,
      createdAt: new Date().toISOString(),
      metadata: { isActive: target.isActive },
    });
    return HttpResponse.json({
      success: true,
      data: target,
      error: null,
    });
  }),

  http.get(`${API_BASE}/admin/audit-logs`, async ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const limit = Math.max(1, Number(url.searchParams.get('limit') ?? 10));
    const start = (page - 1) * limit;
    const paged = mockDb.auditLogs.slice(start, start + limit);
    return HttpResponse.json({
      success: true,
      data: {
        items: paged,
        page,
        limit,
        total: mockDb.auditLogs.length,
        totalPages: Math.max(1, Math.ceil(mockDb.auditLogs.length / limit)),
      },
      error: null,
    });
  }),

  http.post(`${API_BASE}/vocabularies/:id/save`, async ({ params }) => {
    const vocabId = Number(params.id);
    const vocab = mockVocabularies.find((v) => v.id === vocabId);
    if (!vocab) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'VOCABULARY_NOT_FOUND', message: 'Từ vựng không tồn tại', details: null },
        },
        { status: 404 },
      );
    }
    const existing = mockServerSavedWords.find((item) => item.vocabularyId === vocabId);
    if (existing) {
      return HttpResponse.json({ success: true, data: existing, error: null });
    }
    const created: SavedWordRecord = {
      vocabularyId: vocab.id,
      word: vocab.word,
      cefrLevel: vocab.cefrLevel,
      partOfSpeech: vocab.partOfSpeech,
      phonetic: vocab.phonetic,
      vietnameseMeaning: vocab.vietnameseMeaning,
      savedAt: new Date().toISOString(),
    };
    mockServerSavedWords.unshift(created);
    return HttpResponse.json({ success: true, data: created, error: null });
  }),

  http.delete(`${API_BASE}/vocabularies/:id/save`, async ({ params }) => {
    const vocabId = Number(params.id);
    const idx = mockServerSavedWords.findIndex((item) => item.vocabularyId === vocabId);
    if (idx >= 0) {
      mockServerSavedWords.splice(idx, 1);
    }
    return HttpResponse.json({ success: true, data: null, error: null });
  }),

  http.get(`${API_BASE}/learning/history`, async ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const limit = Math.max(1, Number(url.searchParams.get('limit') ?? 50));
    const start = (page - 1) * limit;
    const paged = mockServerHistory.slice(start, start + limit);
    return HttpResponse.json({
      success: true,
      data: {
        items: paged,
        pagination: {
          page,
          limit,
          total: mockServerHistory.length,
          totalPages: Math.max(1, Math.ceil(mockServerHistory.length / limit)),
        },
      },
      error: null,
    });
  }),

  http.post(`${API_BASE}/auth/forgot-password`, async ({ request }) => {
    const body = (await request.json()) as { email?: string };
    const email = (body.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'Email không hợp lệ.', details: null },
        },
        { status: 400 },
      );
    }
    mockPasswordResetOtps.set(email, { otp: '654321', attempts: 0 });
    return HttpResponse.json({
      success: true,
      data: {
        message:
          'Nếu địa chỉ email tồn tại và đang hoạt động, mã OTP 6 chữ số đã được gửi tới hộp thư của bạn (hiệu lực 10 phút).',
      },
      error: null,
    });
  }),

  http.post(`${API_BASE}/auth/reset-password`, async ({ request }) => {
    const body = (await request.json()) as { email?: string; otp?: string; newPassword?: string };
    const email = (body.email ?? '').trim().toLowerCase();
    const otp = (body.otp ?? '').trim();
    const entry = mockPasswordResetOtps.get(email);
    if (!entry || entry.otp !== otp) {
      if (entry) {
        entry.attempts += 1;
        if (entry.attempts >= 5) {
          mockPasswordResetOtps.delete(email);
          return HttpResponse.json(
            {
              success: false,
              data: null,
              error: {
                code: 'OTP_MAX_ATTEMPTS_EXCEEDED',
                message: 'Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng yêu cầu gửi mã mới.',
                details: null,
              },
            },
            { status: 400 },
          );
        }
      }
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INVALID_OR_EXPIRED_OTP',
            message: 'Mã OTP không chính xác hoặc đã hết hạn',
            details: null,
          },
        },
        { status: 400 },
      );
    }
    mockPasswordResetOtps.delete(email);
    return HttpResponse.json({
      success: true,
      data: null,
      error: null,
    });
  }),

  http.get(`${API_BASE}/notifications`, async () => {
    const items = [...mockServerNotifications];
    return HttpResponse.json({
      success: true,
      data: {
        items,
        unreadCount: items.filter((n) => !n.read).length,
      },
      error: null,
    });
  }),

  http.post(`${API_BASE}/notifications`, async ({ request }) => {
    const body = (await request.json()) as {
      title?: string;
      body?: string;
      icon?: string;
      tone?: NotificationItem['tone'];
      targetRoute?: string;
    };
    const created: NotificationItem = {
      id: String(nextNotifId++),
      title: (body.title ?? '').trim() || 'Thông báo mới',
      body: (body.body ?? '').trim(),
      icon: body.icon || 'bell',
      tone: body.tone ?? 'blue',
      targetRoute: body.targetRoute || '/',
      read: false,
      createdAt: new Date().toISOString(),
    };
    mockServerNotifications.unshift(created);
    return HttpResponse.json({ success: true, data: created, error: null }, { status: 201 });
  }),

  http.delete(`${API_BASE}/notifications`, async () => {
    mockServerNotifications.length = 0;
    return HttpResponse.json({ success: true, data: null, error: null });
  }),

  http.patch(`${API_BASE}/notifications/read-all`, async () => {
    mockServerNotifications.forEach((n) => {
      n.read = true;
    });
    return HttpResponse.json({ success: true, data: null, error: null });
  }),

  http.patch(`${API_BASE}/notifications/:id/read`, async ({ params }) => {
    const target = mockServerNotifications.find((n) => n.id === String(params.id));
    if (target) {
      target.read = true;
    }
    return HttpResponse.json({ success: true, data: null, error: null });
  }),

  http.delete(`${API_BASE}/notifications/:id`, async ({ params }) => {
    const idx = mockServerNotifications.findIndex((n) => n.id === String(params.id));
    if (idx >= 0) {
      mockServerNotifications.splice(idx, 1);
    }
    return HttpResponse.json({ success: true, data: null, error: null });
  }),

  http.get(`${API_BASE}/support/messages`, async () => {
    if (mockServerSupportMessages.length === 0) {
      return HttpResponse.json({
        success: true,
        data: [
          {
            id: 'sup-welcome',
            sender: 'admin',
            senderRole: 'admin',
            text: 'Chào bạn! Đội ngũ Quản trị viên LexiTag luôn sẵn sàng hỗ trợ về tài khoản, lộ trình học và góp ý sản phẩm.',
            createdAt: new Date().toISOString(),
          },
        ],
        error: null,
      });
    }
    return HttpResponse.json({
      success: true,
      data: [...mockServerSupportMessages],
      error: null,
    });
  }),

  http.post(`${API_BASE}/support/messages`, async ({ request }) => {
    const body = (await request.json()) as { text?: string };
    const text = (body.text ?? '').trim();
    const userMessage: SupportMessage = {
      id: String(nextSupportMsgId++),
      sender: 'me',
      senderRole: 'learner',
      text,
      createdAt: new Date().toISOString(),
    };
    const replyMessage: SupportMessage = {
      id: String(nextSupportMsgId++),
      sender: 'admin',
      senderRole: 'admin',
      text: 'Cảm ơn bạn đã nhắn tin! QTV đã tiếp nhận yêu cầu và sẽ phản hồi sớm nhất qua hộp thư này hoặc thông báo tài khoản của bạn.',
      createdAt: new Date().toISOString(),
    };
    mockServerSupportMessages.push(userMessage, replyMessage);
    return HttpResponse.json(
      { success: true, data: { userMessage, replyMessage }, error: null },
      { status: 201 },
    );
  }),

  http.get(`${API_BASE}/support/tickets`, async () => {
    return HttpResponse.json({
      success: true,
      data: [...mockServerSupportTickets],
      error: null,
    });
  }),

  http.post(`${API_BASE}/support/tickets`, async ({ request }) => {
    const body = (await request.json()) as { category?: string; email?: string; detail?: string };
    const id = nextSupportTicketId++;
    const ticketId = `TK-${String(100000 + id)}`;
    const category = (body.category ?? 'Góp ý tính năng').trim();
    const created: SupportTicketItem = {
      id,
      ticketId,
      userId: mockLearnerUser.id,
      userFullName: mockLearnerUser.fullName,
      userEmail: mockLearnerUser.email,
      category,
      email: (body.email ?? mockLearnerUser.email).trim(),
      detail: (body.detail ?? '').trim(),
      status: 'open',
      adminReply: null,
      repliedAt: null,
      submittedAt: new Date().toISOString(),
    };
    mockServerSupportTickets.unshift(created);
    mockServerNotifications.unshift({
      id: String(nextNotifId++),
      title: `Đã tiếp nhận góp ý (${ticketId})`,
      body: `Cảm ơn bạn đã gửi "${category}". Đội ngũ QTV sẽ xem xét sớm nhất.`,
      icon: 'message',
      tone: 'purple',
      targetRoute: '/',
      read: false,
      createdAt: new Date().toISOString(),
    });
    return HttpResponse.json({ success: true, data: created, error: null }, { status: 201 });
  }),

  http.get(`${API_BASE}/admin/support/threads`, async () => {
    if (mockServerSupportMessages.length === 0) {
      return HttpResponse.json({ success: true, data: [], error: null });
    }
    const last = mockServerSupportMessages[mockServerSupportMessages.length - 1];
    return HttpResponse.json({
      success: true,
      data: [
        {
          userId: mockLearnerUser.id,
          email: mockLearnerUser.email,
          fullName: mockLearnerUser.fullName,
          messageCount: mockServerSupportMessages.length,
          lastMessage: last.text,
          lastSenderRole: last.senderRole ?? (last.sender === 'me' ? 'learner' : 'admin'),
          lastMessageAt: last.createdAt,
        },
      ],
      error: null,
    });
  }),

  http.get(`${API_BASE}/admin/support/threads/:userId/messages`, async () => {
    return HttpResponse.json({
      success: true,
      data: [...mockServerSupportMessages],
      error: null,
    });
  }),

  http.post(`${API_BASE}/admin/support/threads/:userId/messages`, async ({ params, request }) => {
    const body = (await request.json()) as { text?: string };
    const text = (body.text ?? '').trim();
    const msg: SupportMessage = {
      id: String(nextSupportMsgId++),
      sender: 'admin',
      senderRole: 'admin',
      text,
      createdAt: new Date().toISOString(),
    };
    mockServerSupportMessages.push(msg);
    mockServerNotifications.unshift({
      id: String(nextNotifId++),
      title: 'Phản hồi mới từ Quản trị viên',
      body: text,
      icon: 'message',
      tone: 'blue',
      targetRoute: '/',
      read: false,
      createdAt: new Date().toISOString(),
    });
    mockDb.auditLogs.unshift({
      id: Date.now(),
      actorId: mockAdminUser.id,
      actorEmail: mockAdminUser.email,
      action: 'ADMIN_SUPPORT_MESSAGE_SENT',
      targetType: 'user',
      targetId: Number(params.userId),
      createdAt: new Date().toISOString(),
    });
    return HttpResponse.json({ success: true, data: msg, error: null }, { status: 201 });
  }),

  http.get(`${API_BASE}/admin/support/tickets`, async ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
    const limit = Math.max(1, Number(url.searchParams.get('limit') ?? 20));
    const filtered = status
      ? mockServerSupportTickets.filter((t) => t.status === status)
      : [...mockServerSupportTickets];
    return HttpResponse.json({
      success: true,
      data: {
        items: filtered.slice((page - 1) * limit, page * limit),
        page,
        limit,
        total: filtered.length,
        totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
      },
      error: null,
    });
  }),

  http.patch(`${API_BASE}/admin/support/tickets/:ticketId/reply`, async ({ params, request }) => {
    const ticketId = Number(params.ticketId);
    const body = (await request.json()) as { reply?: string; status?: 'open' | 'resolved' };
    const found = mockServerSupportTickets.find((t) => t.id === ticketId);
    if (!found) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'TICKET_NOT_FOUND', message: 'Không tìm thấy phiếu góp ý', details: null },
        },
        { status: 404 },
      );
    }
    const reply = (body.reply ?? '').trim();
    found.adminReply = reply;
    found.status = body.status ?? 'resolved';
    found.repliedAt = new Date().toISOString();
    mockServerSupportMessages.push({
      id: String(nextSupportMsgId++),
      sender: 'admin',
      senderRole: 'admin',
      text: `[Phản hồi phiếu ${found.ticketId}] ${reply}`,
      createdAt: new Date().toISOString(),
    });
    mockServerNotifications.unshift({
      id: String(nextNotifId++),
      title: `QTV đã phản hồi góp ý (${found.ticketId})`,
      body: reply,
      icon: 'message',
      tone: 'green',
      targetRoute: '/',
      read: false,
      createdAt: new Date().toISOString(),
    });
    mockDb.auditLogs.unshift({
      id: Date.now(),
      actorId: mockAdminUser.id,
      actorEmail: mockAdminUser.email,
      action: 'ADMIN_SUPPORT_TICKET_REPLIED',
      targetType: 'support_ticket',
      targetId: ticketId,
      createdAt: new Date().toISOString(),
    });
    return HttpResponse.json({ success: true, data: found, error: null });
  }),
];
