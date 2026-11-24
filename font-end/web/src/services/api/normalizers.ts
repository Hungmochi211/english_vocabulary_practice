import type {
  AdminSystemStats,
  AdminUserRow,
  AttemptType,
  AuditLogEntry,
  AuthSession,
  CefrLevel,
  GradedAnswerResult,
  GradingStatus,
  LeitnerDistribution,
  LessonProgressItem,
  PaginatedData,
  PracticeMode,
  QuizAttemptStart,
  QuizQuestion,
  QuizSubmitResult,
  ReviewSessionOrigin,
  StatsOverview,
  Topic,
} from '@/types/models';

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function maskWordInSentence(sentence: string, word: string): string {
  const cleanWord = word.trim();
  if (!sentence.trim() || !cleanWord) return sentence;
  const escaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return sentence.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '_____');
}

export function normalizeAuthSession(raw: AuthSession & { expiresIn?: number }): AuthSession {
  return {
    ...raw,
    expiresInSeconds: raw.expiresInSeconds ?? raw.expiresIn ?? 900,
  };
}

export function normalizeTopic(raw: Topic & { code?: string; nameVi?: string; totalLessons?: number }): Topic {
  return {
    id: Number(raw.id),
    name: raw.name ?? raw.nameVi ?? '',
    slug: raw.slug ?? raw.code ?? String(raw.id),
    description: raw.description ?? null,
    lessonCount: raw.lessonCount ?? raw.totalLessons,
  };
}

export function normalizeLessonProgress(
  raw: Partial<LessonProgressItem> & {
    id?: number;
    topicNameVi?: string;
    totalWords?: number;
  },
  fallbackLessonId?: number,
): LessonProgressItem {
  return {
    lessonId: Number(raw.lessonId ?? raw.id ?? fallbackLessonId ?? 0),
    title: raw.title ?? '',
    cefrLevel: (raw.cefrLevel ?? 'A1') as CefrLevel,
    topicId: Number(raw.topicId ?? 0),
    topicName: raw.topicName ?? raw.topicNameVi ?? '',
    orderIndex: Number(raw.orderIndex ?? 0),
    wordCount: Number(raw.wordCount ?? raw.totalWords ?? raw.openedCount ?? 0),
    openedCount: Number(raw.openedCount ?? 0),
    isUnlocked: raw.isUnlocked ?? true,
    acquisitionCompleted: Boolean(raw.acquisitionCompleted),
    isCompleted: Boolean(raw.isCompleted),
    bestScore: raw.bestScore ?? null,
  };
}

export function normalizeQuizQuestion(raw: unknown): QuizQuestion {
  if (!isRecord(raw)) {
    return {
      vocabularyId: 0,
      practiceMode: 'typing',
      prompt: {},
    };
  }

  const practiceMode = (raw.practiceMode ?? 'typing') as PracticeMode;
  const rawPrompt = raw.prompt;

  if (isRecord(rawPrompt)) {
    return {
      vocabularyId: Number(raw.vocabularyId ?? 0),
      practiceMode,
      prompt: {
        word: typeof rawPrompt.word === 'string' ? rawPrompt.word : undefined,
        phonetic: typeof rawPrompt.phonetic === 'string' ? rawPrompt.phonetic : undefined,
        partOfSpeech: typeof rawPrompt.partOfSpeech === 'string' ? rawPrompt.partOfSpeech : undefined,
        cefrLevel: rawPrompt.cefrLevel as CefrLevel | undefined,
        vietnameseMeaning:
          typeof rawPrompt.vietnameseMeaning === 'string' ? rawPrompt.vietnameseMeaning : undefined,
        clozeExampleEn:
          typeof rawPrompt.clozeExampleEn === 'string' ? rawPrompt.clozeExampleEn : undefined,
        audioUrl:
          typeof rawPrompt.audioUrl === 'string' || rawPrompt.audioUrl === null
            ? (rawPrompt.audioUrl as string | null)
            : undefined,
        options: Array.isArray(rawPrompt.options) ? (rawPrompt.options as string[]) : undefined,
      },
    };
  }

  // Real 002 BE returns `prompt` as a display string and puts fields at top-level of the question.
  const word = typeof raw.word === 'string' ? raw.word : undefined;
  const rawCloze =
    typeof raw.clozeExampleEn === 'string' && raw.clozeExampleEn.trim().length > 0
      ? raw.clozeExampleEn
      : typeof raw.exampleEn === 'string' && raw.exampleEn.trim().length > 0
        ? maskWordInSentence(raw.exampleEn, word ?? '')
        : undefined;

  return {
    vocabularyId: Number(raw.vocabularyId ?? 0),
    practiceMode,
    prompt: {
      word,
      phonetic: typeof raw.phonetic === 'string' && raw.phonetic ? raw.phonetic : undefined,
      partOfSpeech:
        typeof raw.partOfSpeech === 'string' && raw.partOfSpeech ? raw.partOfSpeech : undefined,
      cefrLevel: raw.cefrLevel as CefrLevel | undefined,
      vietnameseMeaning:
        typeof raw.vietnameseMeaning === 'string' && raw.vietnameseMeaning
          ? raw.vietnameseMeaning
          : typeof rawPrompt === 'string'
            ? rawPrompt
            : undefined,
      clozeExampleEn: rawCloze,
      audioUrl:
        typeof raw.audioUrl === 'string' || raw.audioUrl === null
          ? (raw.audioUrl as string | null)
          : undefined,
      options: Array.isArray(raw.options) ? (raw.options as string[]) : undefined,
    },
  };
}

export function normalizeQuizAttemptStart(raw: unknown): QuizAttemptStart {
  const obj = isRecord(raw) ? raw : {};
  const questions = Array.isArray(obj.questions)
    ? obj.questions.map((q) => normalizeQuizQuestion(q))
    : [];

  return {
    attemptId: Number(obj.attemptId ?? 0),
    attemptType: (obj.attemptType as AttemptType | undefined) ?? 'lesson_practice',
    totalQuestions: Number(obj.totalQuestions ?? questions.length),
    questions,
  };
}

export function normalizeQuizSubmitResult(raw: unknown): QuizSubmitResult {
  const obj = isRecord(raw) ? raw : {};

  // Build SM-2 lookup when BE returns separate `sm2Updates[]` array.
  const sm2ByVocab = new Map<number, { leitnerBox?: 1 | 2 | 3 | 4 | 5; nextReviewDate?: string }>();
  if (Array.isArray(obj.sm2Updates)) {
    for (const item of obj.sm2Updates) {
      if (!isRecord(item)) continue;
      const vid = Number(item.vocabularyId);
      const box = Number(item.leitnerBox);
      sm2ByVocab.set(vid, {
        leitnerBox: box >= 1 && box <= 5 ? (box as 1 | 2 | 3 | 4 | 5) : undefined,
        nextReviewDate:
          typeof item.nextReviewDate === 'string' ? item.nextReviewDate : undefined,
      });
    }
  }

  const rawList = Array.isArray(obj.results)
    ? obj.results
    : Array.isArray(obj.answers)
      ? obj.answers
      : [];

  const results: GradedAnswerResult[] = rawList.map((item) => {
    const r = isRecord(item) ? item : {};
    const vocabularyId = Number(r.vocabularyId ?? 0);
    const sm2 = sm2ByVocab.get(vocabularyId);
    const pointsAwarded = Number(r.pointsAwarded ?? r.score ?? 0);
    const rawBox = r.newLeitnerBox ?? sm2?.leitnerBox;
    const boxNum = Number(rawBox);

    return {
      vocabularyId,
      word: String(r.word ?? ''),
      phonetic: typeof r.phonetic === 'string' && r.phonetic ? r.phonetic : undefined,
      vietnameseMeaning:
        typeof r.vietnameseMeaning === 'string' && r.vietnameseMeaning
          ? r.vietnameseMeaning
          : undefined,
      userAnswer: typeof r.userAnswer === 'string' ? r.userAnswer : null,
      gradingStatus: (r.gradingStatus ?? 'incorrect') as GradingStatus,
      pointsAwarded,
      feedbackMessage: String(r.feedbackMessage ?? ''),
      newLeitnerBox: boxNum >= 1 && boxNum <= 5 ? (boxNum as 1 | 2 | 3 | 4 | 5) : undefined,
      nextReviewDate:
        typeof r.nextReviewDate === 'string' ? r.nextReviewDate : sm2?.nextReviewDate,
    };
  });

  const totalQuestions = Number(obj.totalQuestions ?? results.length);
  const totalScore = Number(
    obj.totalScore ?? results.reduce((sum, item) => sum + item.pointsAwarded, 0),
  );
  const scorePercent = Number(obj.scorePercent ?? obj.scorePercentage ?? 0);
  const correctCount =
    typeof obj.correctCount === 'number'
      ? obj.correctCount
      : results.filter((item) => item.gradingStatus === 'exact' || item.pointsAwarded >= 1).length;
  const xpEarned =
    typeof obj.xpEarned === 'number' ? obj.xpEarned : Math.max(0, Math.round(totalScore * 10));

  let streakUpdated = obj.streakUpdated as QuizSubmitResult['streakUpdated'];
  if (!streakUpdated && isRecord(obj.streak)) {
    streakUpdated = {
      currentStreak: Number(obj.streak.currentStreak ?? 0),
      completedToday: Boolean(obj.streak.streakQualified),
    };
  }

  let nextLessonUnlockedId: number | null | undefined =
    typeof obj.nextLessonUnlockedId === 'number' || obj.nextLessonUnlockedId === null
      ? (obj.nextLessonUnlockedId as number | null)
      : undefined;
  if (nextLessonUnlockedId === undefined && typeof obj.nextLessonUnlocked === 'boolean') {
    nextLessonUnlockedId = obj.nextLessonUnlocked ? 1 : null;
  }

  return {
    attemptId: typeof obj.attemptId === 'number' ? obj.attemptId : null,
    origin: (obj.origin as ReviewSessionOrigin | undefined) ?? 'server_official',
    scorePercent,
    passed: Boolean(obj.passed),
    correctCount,
    totalQuestions,
    xpEarned,
    ...(nextLessonUnlockedId !== undefined ? { nextLessonUnlockedId } : {}),
    ...(streakUpdated ? { streakUpdated } : {}),
    results,
  };
}

export function normalizeStatsOverview(raw: unknown): StatsOverview {
  const obj = isRecord(raw) ? raw : {};
  const rawBoxes = isRecord(obj.leitnerDistribution)
    ? obj.leitnerDistribution
    : isRecord(obj.leitnerBoxes)
      ? obj.leitnerBoxes
      : {};

  const leitnerDistribution: LeitnerDistribution = {
    box1: Number(rawBoxes.box1 ?? 0),
    box2: Number(rawBoxes.box2 ?? 0),
    box3: Number(rawBoxes.box3 ?? 0),
    box4: Number(rawBoxes.box4 ?? 0),
    box5: Number(rawBoxes.box5 ?? 0),
  };

  const sumLeitner =
    leitnerDistribution.box1 +
    leitnerDistribution.box2 +
    leitnerDistribution.box3 +
    leitnerDistribution.box4 +
    leitnerDistribution.box5;

  const rawDays = Array.isArray(obj.last7Days) ? obj.last7Days : [];
  const last7Days = rawDays.map((entry) => {
    const d = isRecord(entry) ? entry : {};
    const wordsLearned = Number(d.wordsLearned ?? 0);
    const wordsReviewed = Number(d.wordsReviewed ?? 0);
    const wordsStudied = Number(d.wordsStudied ?? wordsLearned + wordsReviewed);
    return {
      date: String(d.date ?? ''),
      wordsStudied,
      reviewsCompleted: Number(d.reviewsCompleted ?? wordsReviewed),
      xpEarned: typeof d.xpEarned === 'number' ? d.xpEarned : undefined,
      completedGoal: Boolean(d.completedGoal ?? d.streakQualified),
    };
  });

  const latestDay = last7Days[last7Days.length - 1];
  const completedToday =
    typeof obj.completedToday === 'boolean'
      ? obj.completedToday
      : Boolean(latestDay?.completedGoal);

  return {
    currentStreak: Number(obj.currentStreak ?? 0),
    longestStreak: Number(obj.longestStreak ?? 0),
    completedToday,
    totalXp: Number(obj.totalXp ?? 0),
    learnedWordsCount: Number(obj.learnedWordsCount ?? sumLeitner),
    dueReviewsCount: Number(obj.dueReviewsCount ?? obj.dueReviewsToday ?? 0),
    leitnerDistribution,
    last7Days,
  };
}

export function normalizePaginatedData<T>(
  raw: unknown,
  mapItem?: (item: unknown) => T,
): PaginatedData<T> {
  const obj = isRecord(raw) ? raw : {};
  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items = mapItem ? rawItems.map(mapItem) : (rawItems as T[]);
  const meta = isRecord(obj.pagination) ? obj.pagination : obj;

  const page = Number(meta.page ?? 1);
  const limit = Number(meta.limit ?? (items.length || 20));
  const total = Number(meta.total ?? items.length);
  const totalPages = Math.max(1, Number(meta.totalPages ?? Math.ceil(total / Math.max(1, limit))));

  return {
    items,
    page,
    limit,
    total,
    totalPages,
  };
}

export function normalizeAdminSystemStats(raw: unknown): AdminSystemStats {
  const obj = isRecord(raw) ? raw : {};
  return {
    totalUsers: Number(obj.totalUsers ?? 0),
    activeUsersToday: Number(obj.activeUsersToday ?? obj.activeLearnersToday ?? 0),
    totalVocabularyCount: Number(obj.totalVocabularyCount ?? 0),
    totalAttemptsToday: Number(obj.totalAttemptsToday ?? obj.totalSubmittedQuizzes ?? 0),
  };
}

export function normalizeAdminUserRow(raw: unknown): AdminUserRow {
  const obj = isRecord(raw) ? raw : {};
  return {
    id: Number(obj.id ?? 0),
    email: String(obj.email ?? ''),
    fullName: String(obj.fullName ?? ''),
    role: (obj.role ?? 'learner') as AdminUserRow['role'],
    targetLevel: (obj.targetLevel ?? 'B1') as CefrLevel,
    isActive: Boolean(obj.isActive),
    currentStreak: Number(obj.currentStreak ?? 0),
    createdAt: String(obj.createdAt ?? ''),
  };
}

export function normalizeAuditLogEntry(raw: unknown): AuditLogEntry {
  const obj = isRecord(raw) ? raw : {};
  return {
    id: Number(obj.id ?? 0),
    actorId: Number(obj.actorId ?? obj.actorUserId ?? 0),
    actorEmail: typeof obj.actorEmail === 'string' ? obj.actorEmail : undefined,
    action: String(obj.action ?? ''),
    targetType: String(obj.targetType ?? ''),
    targetId: (obj.targetId as number | string | undefined) ?? '',
    createdAt: String(obj.createdAt ?? ''),
    metadata: isRecord(obj.metadata) ? obj.metadata : undefined,
  };
}
