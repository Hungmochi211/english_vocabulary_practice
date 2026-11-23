# Frontend Data Model & State Architecture (`004-frontend-webapp`)

**Feature**: `004-frontend-webapp` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

Tài liệu này định nghĩa toàn bộ mô hình kiểu dữ liệu TypeScript phía Frontend, ánh xạ 1-1 với hợp đồng API từ `001-vocabulary-data` và `002-backend-core`, cùng các mô hình trạng thái cục bộ và luồng chuyển trạng thái UI.

---

## 1. API Response Envelope (Chuẩn Hiến pháp Điều IV)

Mọi phản hồi từ Backend đều tuân theo bao bọc thống nhất:

```typescript
export interface ApiErrorDetail {
  code: string;        // VD: 'UNAUTHORIZED', 'ACCOUNT_DISABLED', 'RATE_LIMIT_EXCEEDED', 'ATTEMPT_ALREADY_SUBMITTED'
  message: string;     // Thông báo tiếng Việt hiển thị cho người dùng
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
```

---

## 2. Xác thực & Hồ sơ Người dùng (`US-1`, `US-5`)

```typescript
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
  expiresInSeconds: number; // 900 (15 phút)
  user: UserProfile;
}

export interface UpdateProfilePayload {
  fullName?: string;              // 1..100 ký tự
  avatarUrl?: string | null;      // URI hợp lệ, <= 500 ký tự
  targetLevel?: CefrLevel;
  emailReminderEnabled?: boolean;
}

export interface ClientPreferences {
  dailyWordGoal: number;          // 5..50, mặc định 25 (UI mục tiêu ngày)
  preferredAccent: 'en-US' | 'en-GB';
  reminderTimeLocal: string;      // VD: '20:00'
  streakWarningEnabled: boolean;
  strictUnlockNotice: boolean;
}
```

**Validation Rules (trước khi gửi API)**:
- `email`: đúng định dạng email chuẩn.
- `password`: tối thiểu 8 ký tự khi đăng ký / đổi mật khẩu; `confirmPassword === newPassword` và `newPassword !== currentPassword`.
- `fullName`: cắt khoảng trắng 2 đầu, độ dài `1..100`.
- `dailyWordGoal`: số nguyên trong khoảng `[5, 50]`.

---

## 3. Từ vựng, Chủ đề & Bài học (`US-2`, `US-4`)

Ánh xạ trực tiếp từ `001-vocabulary-data` (`9` cột chuẩn hóa) và `002-backend-core`:

```typescript
export interface Topic {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  lessonCount?: number;
}

export interface VocabularyItem {
  id: number;
  word: string;                   // Chuỗi chữ sạch 100%, không homonym/ngoặc/\xa0
  cefrLevel: CefrLevel;
  partOfSpeech: string;           // 'n.' | 'v.' | 'adj.' | 'adv.' | ...
  phonetic: string;               // IPA
  vietnameseMeaning: string;
  exampleEn: string;
  exampleVi: string;
  topicId: number;
  topicName?: string;
  audioUrl: string | null;        // URL tĩnh VARCHAR(500), không Blob/Base64
}

export interface LessonProgressItem {
  lessonId: number;
  title: string;
  cefrLevel: CefrLevel;
  topicId: number;
  topicName: string;
  orderIndex: number;             // Bài 1 mở khóa sẵn
  wordCount: number;              // 15–18 từ (bài cuối <= 20)
  openedCount: number;            // Số thẻ đã mở ở Bước 1
  isUnlocked: boolean;
  acquisitionCompleted: boolean;  // true khi openedCount === wordCount
  isCompleted: boolean;           // true khi bestScore >= 80
  bestScore: number | null;       // 0..100
}
```

---

## 4. Phiên Luyện tập, Chấm điểm & SM-2 (`US-2`, `US-3`)

```typescript
export type AttemptType = 'lesson_practice' | 'sm2_review' | 'mixed_quiz';
export type PracticeMode = 'multiple_choice' | 'typing' | 'dictation';
// Khớp 1-1 với grading_status_enum trong specs/002-backend-core/data-model.md
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
    options?: string[];           // Đúng 4 phương án đã Fisher-Yates shuffle (multiple_choice)
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
  userAnswer: string | null;      // <= 100 ký tự
  responseTimeMs: number;         // Kẹp [0, 300000] đo từ lúc hiện câu hỏi
}

export interface GradedAnswerResult {
  vocabularyId: number;
  word: string;
  phonetic?: string;
  vietnameseMeaning?: string;
  userAnswer: string | null;
  gradingStatus: GradingStatus;   // Khớp grading_status_enum của 002; 'near_match' chỉ hợp lệ với từ dài >= 3 ký tự, từ < 3 ký tự luôn trả 'incorrect'
  pointsAwarded: number;          // 1.0 (exact) | 0.5 (near_match, word.length >= 3) | 0.0 (phonetic_match/incorrect)
  feedbackMessage: string;        // Thông điệp phản hồi tiếng Việt
  newLeitnerBox?: 1 | 2 | 3 | 4 | 5;
  nextReviewDate?: string;        // YYYY-MM-DD (UTC+7)
}

export interface QuizSubmitResult {
  attemptId: number | null;       // null nếu là phiên luyện tập tự chọn cục bộ (client_custom_practice)
  origin: ReviewSessionOrigin;
  scorePercent: number;           // 0..100
  passed: boolean;                // scorePercent >= 80
  correctCount: number;
  totalQuestions: number;
  xpEarned: number;               // 0 cho client_custom_practice (không ghi đè SM-2/Streak máy chủ)
  nextLessonUnlockedId?: number | null;
  streakUpdated?: {
    currentStreak: number;
    completedToday: boolean;
  };
  results: GradedAnswerResult[];
}
```

### State Transitions (Chu trình Học 2 Bước & Phiên làm bài)

```text
[Lesson Locked] --(bài trước >= 80%)--> [Lesson Unlocked / Step 1: Acquisition]
  |
  |--(mở từng thẻ: POST /cards/:vocabId/open)--> openedCount++
  |--(openedCount == wordCount)----------------> acquisitionCompleted = true
                                                      |
                                                      v
                                        [Step 2: Practice Active]
                                          |--(submit < 80%)--> [Retry Practice] (SM-2 vẫn cập nhật)
                                          |--(submit >= 80%)-> [Lesson Completed] -> Mở khóa bài kế tiếp
```

---

## 5. Thống kê Tiến độ & Quản trị viên (`US-2`, `US-5`, `US-8`)

```typescript
export interface LeitnerDistribution {
  box1: number;
  box2: number;
  box3: number;
  box4: number;
  box5: number;
}

export interface DailyStudyPoint {
  date: string;                   // YYYY-MM-DD (UTC+7)
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
```

---

## 6. Mô hình Tiện ích Cục bộ v1 qua Adapter (`US-5`, `US-6`, `US-7`)

Các thực thể dưới đây được tách riêng sau interface Provider (lưu trên `localStorage` ở v1, sẵn sàng chuyển sang API Backend sau này):

| Thực thể | Khóa lưu trữ v1 | Trường chính |
| :--- | :--- | :--- |
| `SavedWordRecord` | `lexitag:v1:saved-words` | `vocabularyId`, `word`, `cefrLevel`, `partOfSpeech`, `phonetic`, `vietnameseMeaning`, `savedAt` |
| `ActivityHistoryItem` | `lexitag:v1:history` | `id`, `type` (`study`\|`pronunciation`\|`srs`\|`quiz`\|`typing`\|`dictation`), `title`, `correct`, `total`, `accuracy`, `xp`, `duration`, `createdAt`, `words: Array<{ vocabularyId?, word, phonetic, meaning, ok }>` |
| `LeaderboardMember` | `lexitag:v1:leaderboard` | `userId`, `fullName`, `avatarUrl`, `level`, `weeklyXp`, `wordsThisWeek`, `streakDays`, `badges[]`, `isCurrentUser`, `rank` *(không chứa email/SĐT)* |
| `NotificationItem` | `lexitag:v1:notifications` | `id`, `title`, `body`, `icon`, `tone`, `targetRoute`, `read`, `createdAt` |
| `AiConversation` | `lexitag:v1:ai-chats` | `id`, `title`, `updatedAt`, `messages: Array<{ id, role: 'user'\|'assistant', content, detectedWords?: string[], createdAt }>` |
| `SupportMessage` | `lexitag:v1:support-chat` | `id`, `sender: 'me'\|'admin'`, `text`, `createdAt` |
