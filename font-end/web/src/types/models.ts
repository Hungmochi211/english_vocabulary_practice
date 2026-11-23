export interface ApiErrorDetail {
  code: string;
  message: string;
  details: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiErrorDetail | null;
}

export interface PaginatedData<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2';
export type UserRole = 'learner' | 'admin';

export interface UserProfile {
  id: number;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: UserRole;
  targetLevel: CefrLevel;
  emailReminderEnabled: boolean;
  isActive: boolean;
  createdAt?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: UserProfile;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
}

export interface UpdateProfilePayload {
  fullName?: string;
  avatarUrl?: string | null;
  targetLevel?: CefrLevel;
  emailReminderEnabled?: boolean;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface Topic {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  lessonCount?: number;
}

export interface VocabularyItem {
  id: number;
  word: string;
  cefrLevel: CefrLevel;
  partOfSpeech: string;
  phonetic: string;
  vietnameseMeaning: string;
  exampleEn: string;
  exampleVi: string;
  topicId: number;
  topicName?: string;
  audioUrl: string | null;
}

export interface LessonProgressItem {
  lessonId: number;
  title: string;
  cefrLevel: CefrLevel;
  topicId: number;
  topicName: string;
  orderIndex: number;
  wordCount: number;
  openedCount: number;
  isUnlocked: boolean;
  acquisitionCompleted: boolean;
  isCompleted: boolean;
  bestScore: number | null;
}

export interface LessonDetail {
  id: number;
  title: string;
  cefrLevel: CefrLevel;
  topicId: number;
  topicName: string;
  orderIndex: number;
  wordCount: number;
  openedVocabularyIds?: number[];
  vocabularies: VocabularyItem[];
}

export interface DueReviewItem {
  vocabularyId: number;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  cefrLevel: CefrLevel;
  vietnameseMeaning: string;
  exampleEn: string;
  exampleVi: string;
  audioUrl: string | null;
  leitnerBox: 1 | 2 | 3 | 4 | 5;
  nextReviewDate: string;
}

export interface DueReviewsResponse {
  dueCount: number;
  leitnerDistribution: LeitnerDistribution;
  items: DueReviewItem[];
}

export type AttemptType = 'lesson_practice' | 'sm2_review' | 'mixed_quiz';
export type PracticeMode = 'multiple_choice' | 'typing' | 'dictation';
export type GradingStatus = 'exact' | 'near_match' | 'phonetic_match' | 'incorrect';
export type ReviewSessionOrigin = 'server_official' | 'client_custom_practice';

export interface QuizQuestion {
  vocabularyId: number;
  practiceMode: PracticeMode;
  prompt: {
    word?: string;
    phonetic?: string;
    partOfSpeech?: string;
    cefrLevel?: CefrLevel;
    vietnameseMeaning?: string;
    clozeExampleEn?: string;
    audioUrl?: string | null;
    options?: string[];
  };
}

export interface QuizAttemptStart {
  attemptId: number;
  attemptType: AttemptType;
  totalQuestions: number;
  questions: QuizQuestion[];
}

export interface QuizAnswerSubmission {
  vocabularyId: number;
  userAnswer: string | null;
  responseTimeMs: number;
}

export interface GradedAnswerResult {
  vocabularyId: number;
  word: string;
  phonetic?: string;
  vietnameseMeaning?: string;
  userAnswer: string | null;
  gradingStatus: GradingStatus;
  pointsAwarded: number;
  feedbackMessage: string;
  newLeitnerBox?: 1 | 2 | 3 | 4 | 5;
  nextReviewDate?: string;
}

export interface QuizSubmitResult {
  attemptId: number | null;
  origin: ReviewSessionOrigin;
  scorePercent: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  xpEarned: number;
  nextLessonUnlockedId?: number | null;
  streakUpdated?: {
    currentStreak: number;
    completedToday: boolean;
  };
  results: GradedAnswerResult[];
}

export interface LeitnerDistribution {
  box1: number;
  box2: number;
  box3: number;
  box4: number;
  box5: number;
}

export interface DailyStudyPoint {
  date: string;
  wordsStudied: number;
  reviewsCompleted: number;
  xpEarned?: number;
  completedGoal: boolean;
}

export interface StatsOverview {
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  totalXp: number;
  learnedWordsCount: number;
  dueReviewsCount: number;
  leitnerDistribution: LeitnerDistribution;
  last7Days: DailyStudyPoint[];
}

export interface AdminUserRow {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  targetLevel: CefrLevel;
  isActive: boolean;
  currentStreak: number;
  createdAt: string;
}

export interface AdminSystemStats {
  totalUsers: number;
  activeUsersToday: number;
  totalVocabularyCount: number;
  totalAttemptsToday: number;
}

export interface AuditLogEntry {
  id: number;
  actorId: number;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId: number | string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface SavedWordRecord {
  vocabularyId: number;
  word: string;
  cefrLevel: CefrLevel;
  partOfSpeech: string;
  phonetic: string;
  vietnameseMeaning: string;
  savedAt: string;
}

export interface ActivityHistoryWord {
  vocabularyId?: number;
  word: string;
  phonetic?: string;
  meaning?: string;
  ok: boolean;
}

export interface ActivityHistoryItem {
  id: string;
  type: 'study' | 'pronunciation' | 'srs' | 'quiz' | 'typing' | 'dictation';
  title: string;
  correct: number;
  total: number;
  accuracy: number;
  xp: number;
  duration: string;
  createdAt: string;
  words: ActivityHistoryWord[];
}

export interface LeaderboardMember {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  level: CefrLevel;
  weeklyXp: number;
  wordsThisWeek: number;
  streakDays: number;
  badges: string[];
  isCurrentUser: boolean;
  rank: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  icon: string;
  tone: 'amber' | 'green' | 'blue' | 'purple';
  targetRoute: string;
  read: boolean;
  createdAt: string;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  detectedWords?: string[];
  createdAt: string;
}

export interface AiConversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: AiChatMessage[];
}

export interface SupportMessage {
  id: string;
  sender: 'me' | 'admin';
  text: string;
  createdAt: string;
}
