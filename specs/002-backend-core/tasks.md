---

description: "Actionable, dependency-ordered task list for 002-backend-core implementation"
---

# Tasks: 002-backend-core — Xác thực, Động cơ Học tập 2 bước, SM-2 & Streak

**Input**: Design documents from `specs/002-backend-core/` (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`)  
**Prerequisites**: Feature `001-vocabulary-data` (`topics`, `vocabularies`, `lessons`, `lesson_vocabularies`, `cefr_level_enum`) đã tồn tại trong PostgreSQL 16+ (`back-end/`).  
**Tests**: Bắt buộc theo Hiến pháp Điều III (TDD Red $\rightarrow$ Green cho thuật toán thuần và Integration Test Supertest cho toàn bộ `US1`–`US5`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Có thể chạy song song (khác file, không phụ thuộc task chưa xong)
- **[Story]**: Ánh xạ User Story (`US1`, `US2`, `US3`, `US4`, `US5`)
- Toàn bộ mã nguồn Backend nằm trong `back-end/` theo Hiến pháp Điều VI.

---

## Phase 1: Setup (Shared Infrastructure & Dependencies)

**Purpose**: Cài đặt các gói phụ thuộc cho `002-backend-core`, cấu hình Redis 7+ và biến môi trường.

- [X] T001 Cài đặt dependencies NestJS cho Auth, Redis, BullMQ, Schedule, Mailer và Testing (`@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `google-auth-library`, `bcrypt`, `@nestjs/bullmq`, `bullmq`, `ioredis`, `@nestjs/schedule`, `nodemailer`, `@types/bcrypt`, `@types/nodemailer`, `supertest`, `@types/supertest`) trong `back-end/package.json`
- [X] T002 [P] Bổ sung service `redis` (`redis:7-alpine`, port `6379`, healthcheck `redis-cli ping`) vào `docker-compose.yml`
- [X] T003 [P] Bổ sung các biến môi trường mẫu (`JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN=900`, `JWT_REFRESH_EXPIRES_DAYS=7`, `GOOGLE_CLIENT_ID`, `REDIS_HOST`, `REDIS_PORT`, `AUTH_MAX_ATTEMPTS_PER_IP=20`, `AUTH_MAX_ATTEMPTS_PER_ACCOUNT=5`, `AUTH_LOCKOUT_SECONDS=900`, `STRICT_UNLOCK_MODE=true`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) vào `back-end/.env.example` (tuyệt đối không commit `back-end/.env`)
- [X] T004 [P] Tạo cấu hình typed config `back-end/src/config/auth.config.ts` và `back-end/src/config/redis.config.ts` đọc từ biến môi trường

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Hạ tầng dùng chung bắt buộc hoàn thành trước khi triển khai bất kỳ User Story nào (DB Migration, Timezone, Envelope & Exception Filter, Auth/RBAC Guards, AuditModule).

**⚠️ CRITICAL**: Không bắt đầu các phase User Story trước khi Phase 2 hoàn tất.

- [X] T005 Tạo TypeORM migration `back-end/src/database/migrations/1700000000002-CreateCoreLearningTables.ts` chạy trong 1 transaction PostgreSQL duy nhất (kèm `down()` hoàn tác theo thứ tự ngược phụ thuộc không đụng bảng `001`), tạo 6 enums mới và 9 bảng (`users`, `refresh_sessions`, `user_lesson_progress`, `quiz_attempts`, `quiz_attempt_answers`, `user_sm2_reviews`, `user_streaks`, `daily_study_logs`, `audit_logs`) với đầy đủ `CHECK`, `UNIQUE`, composite FK `fk_answer_attempt_owner`, và index theo `data-model.md` §4
- [X] T006 [P] Tạo tiện ích múi giờ `Asia/Ho_Chi_Minh` (`UTC+7`) `back-end/src/common/utils/timezone.util.ts` cung cấp `getTodayUtc7Date()`, `addDaysUtc7(date, days)`, và `getLast7DaysUtc7()`
- [X] T007 [P] Tạo response envelope interceptor `{ success: true, data, error: null }` trong `back-end/src/common/interceptors/response-envelope.interceptor.ts` và global exception filter `{ success: false, data: null, error: { code, message, details } }` trong `back-end/src/common/filters/http-exception.filter.ts` (ẩn stack trace, chuỗi kết nối DB/Redis và lỗi nội bộ Google/SMTP)
- [X] T008 [P] Tạo decorators `@CurrentUser()` trong `back-end/src/common/decorators/current-user.decorator.ts` và `@Roles()` trong `back-end/src/common/decorators/roles.decorator.ts`
- [X] T009 [P] Tạo `JwtAuthGuard` trong `back-end/src/common/guards/jwt-auth.guard.ts` và `RolesGuard` trong `back-end/src/common/guards/roles.guard.ts`
- [X] T010 Tạo entity `AuditLog` trong `back-end/src/modules/audit/entities/audit-log.entity.ts` (`actor_user_id ON DELETE SET NULL`, `action VARCHAR(80)`, `target_type VARCHAR(50)`, `target_id VARCHAR(100)`, `status IN ('SUCCESS','FAILED')`, `metadata JSONB`, `ip_address VARCHAR(45)`) và `AuditService` + `AuditModule` trong `back-end/src/modules/audit/audit.service.ts` (lọc bỏ password, token, `idToken` trước khi ghi log)

**Checkpoint**: Database schema đã migrate, envelope/exception filter, guards và `AuditService` sẵn sàng.

---

## Phase 3: User Story 1 — Đăng ký, đăng nhập, quản lý phiên & hồ sơ học viên (Priority: P1) 🎯 MVP

**Goal**: Cung cấp luồng đăng ký/đăng nhập Email + Mật khẩu, đăng nhập Google OAuth 2.0, xoay vòng Refresh Token kèm Reuse Detection, đổi mật khẩu thu hồi mọi thiết bị, giới hạn dò mật khẩu IP + tài khoản, quản lý hồ sơ cá nhân và 3 endpoint quản trị tài khoản/audit log.

**Independent Test**: Chạy `back-end/tests/integration/auth-users.e2e-spec.ts` kiểm chứng đủ `US1-AS1` đến `US1-AS15` độc lập với bài học.

### Tests for User Story 1 (TDD — viết trước, xác nhận FAIL trước khi code) ⚠️

- [X] T011 [P] [US1] Viết integration tests cho Auth & Users (`US1-AS1`–`US1-AS15`, `openapi.yaml` validation bounds, loại bỏ trường nhạy cảm, phân trang `/admin/users` & `/admin/audit-logs`, fail-closed Redis `503`) trong `back-end/tests/integration/auth-users.e2e-spec.ts`

### Implementation for User Story 1

- [X] T012 [P] [US1] Tạo entity `User` trong `back-end/src/modules/users/entities/user.entity.ts` khớp `data-model.md` §2.1 (`email VARCHAR(255) UNIQUE`, `password_hash NULL`, `full_name VARCHAR(100)`, `avatar_url VARCHAR(500) NULL`, `target_level cefr_level_enum DEFAULT 'B1'`, `role user_role_enum DEFAULT 'learner'`, `auth_provider auth_provider_enum DEFAULT 'local'`, `google_id VARCHAR(100) NULL UNIQUE`, `email_reminder_enabled BOOLEAN DEFAULT TRUE`, `token_version INT DEFAULT 1`, `is_active BOOLEAN DEFAULT TRUE`)
- [X] T013 [P] [US1] Tạo entity `RefreshSession` trong `back-end/src/modules/users/entities/refresh-session.entity.ts` khớp `data-model.md` §2.2 (`session_family_id UUID`, `token_hash CHAR(64) UNIQUE`, `replaced_by_hash CHAR(64) NULL`, `is_revoked BOOLEAN`, `revoked_at TIMESTAMPTZ NULL`, `expires_at > created_at`)
- [X] T014 [P] [US1] Tạo Auth DTOs (`RegisterDto`: email `maxLength: 255`, fullName `1..100`, password `8..72` regex chữ+số; `LoginDto`: email `maxLength: 255`, password `1..72`; `GoogleLoginDto`: `idToken`; `RefreshDto`; `LogoutDto`; `ChangePasswordDto`: `currentPassword`, `newPassword 8..72`) trong `back-end/src/modules/auth/dto/auth.dto.ts`
- [X] T015 [P] [US1] Tạo Users & Admin DTOs (`UpdateProfileDto`: `fullName 1..100`, `avatarUrl` URI `maxLength: 500` nullable, `targetLevel A1..B2`, `emailReminderEnabled` boolean; `AdminPaginationQueryDto`: `page >= 1` default `1`, `1 <= limit <= 100` default `20`; `AdminUpdateStatusDto`: `isActive` boolean) trong `back-end/src/modules/users/dto/users.dto.ts`
- [X] T016 [US1] Cài đặt `RateLimiterService` trên Redis trong `back-end/src/modules/auth/rate-limiter.service.ts` (đếm theo cả IP và `LOWER(TRIM(email))`, ngưỡng cấu hình `AUTH_MAX_ATTEMPTS_PER_IP` / `AUTH_MAX_ATTEMPTS_PER_ACCOUNT`, tạm hoãn `AUTH_LOCKOUT_SECONDS`, áp dụng `fail-closed` trả `503 SERVICE_UNAVAILABLE` khi Redis lỗi)
- [X] T017 [US1] Cài đặt `JwtStrategy` trong `back-end/src/modules/auth/strategies/jwt.strategy.ts` (đối chiếu `token_version` & `session_family_id` trên Redis với fallback `users.token_version` trong PostgreSQL cho các thao tác học tập thường khi Redis gián đoạn, từ chối nếu `is_active = false`)
- [X] T018 [US1] Cài đặt `AuthService` trong `back-end/src/modules/auth/auth.service.ts`: đăng ký (`bcrypt` salt $\ge 10$, khởi tạo `user_streaks` = 0), đăng nhập thông báo lỗi chung, xác thực Google ID Token (`google-auth-library` kiểm `aud`, `iss`, `exp`, `email_verified === true`, trả `401`/`503` an toàn), cấp & xoay vòng Refresh Token SHA-256 + Reuse Detection thu hồi cả `session_family_id` + ghi Redis blacklist, `logout` thu hồi ngay refresh token, `changePassword` tăng `token_version` & thu hồi toàn bộ phiên mọi thiết bị, ghi `audit_logs` (`AUTH_REGISTER`, `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`, `AUTH_GOOGLE_LOGIN`, `AUTH_LOGOUT`, `AUTH_PASSWORD_CHANGED`, `AUTH_REUSE_DETECTED`)
- [X] T019 [US1] Cài đặt `UsersService` trong `back-end/src/modules/users/users.service.ts`: xem/cập nhật hồ sơ cá nhân (loại bỏ tuyệt đối `password_hash`, `token_hash`, `replaced_by_hash`, `token_version`), truy vấn phân trang `/admin/users`, khóa/mở khóa `is_active`, và truy vấn phân trang `/admin/audit-logs`
- [X] T020 [US1] Cài đặt `AuthController` (`POST /auth/register`, `POST /auth/login`, `POST /auth/google`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/change-password`) trong `back-end/src/modules/auth/auth.controller.ts` và `UsersController` + `AdminController` (`/users/me`, `/admin/users`, `/admin/users/:userId/status`, `/admin/audit-logs`) trong `back-end/src/modules/users/users.controller.ts`

**Checkpoint**: User Story 1 hoàn chỉnh, chạy pass toàn bộ `auth-users.e2e-spec.ts` (MVP ready).

---

## Phase 4: User Story 2 — Học bài theo chu trình 2 bước và mở khóa bài học kế tiếp (Priority: P1)

**Goal**: Quản lý tiến độ từng bài học, bắt buộc mở 100% thẻ từ ở Bước 1 (Học nạp) trước khi khởi tạo Bước 2 (Học áp dụng), mở sẵn Bài 1 mọi chủ đề/cấp độ và mở khóa tuần tự Bài $k \ge 2$ khi Bài $k-1$ đạt $\ge 80,00\%$.

**Independent Test**: Chạy `back-end/tests/integration/learning-flow.e2e-spec.ts` kiểm chứng `US2-AS1`–`US2-AS6`.

### Tests for User Story 2 (TDD — viết trước, xác nhận FAIL trước khi code) ⚠️

- [X] T021 [P] [US2] Viết integration tests cho chu trình 2 bước và cổng mở khóa (`US2-AS1`–`US2-AS6`: Bài 1 mở sẵn, chặn mở thẻ không thuộc bài học, chặn `practice/start` khi chưa xong Học nạp, mở khóa bài kế khi $\ge 80.00\%$, làm lại $< 80\%$ giữ nguyên `isCompleted` & `bestScore`, chế độ `STRICT_UNLOCK_MODE=false`) trong `back-end/tests/integration/learning-flow.e2e-spec.ts`

### Implementation for User Story 2

- [X] T022 [P] [US2] Tạo entity `UserLessonProgress` trong `back-end/src/modules/learning/entities/user-lesson-progress.entity.ts` (`UNIQUE (user_id, lesson_id)`, `opened_vocabulary_ids INT[]`, `acquisition_completed BOOLEAN`, `is_completed BOOLEAN`, `best_score DECIMAL(5,2)`, `attempts_count INT`, `first_completed_at TIMESTAMPTZ NULL`)
- [X] T023 [P] [US2] Tạo entity `QuizAttempt` trong `back-end/src/modules/learning/entities/quiz-attempt.entity.ts` (`attempt_type`, `status`, `questions_snapshot JSONB`, `due_count_snapshot INT NULL`, `total_questions > 0`, `total_score`, `score_percentage`, `started_at`, `submitted_at`) và `QuizAttemptAnswer` trong `back-end/src/modules/learning/entities/quiz-attempt-answer.entity.ts` (composite FK `(attempt_id, user_id)`, `UNIQUE (attempt_id, vocabulary_id)`)
- [X] T024 [P] [US2] Tạo Learning DTOs (`LessonsQueryDto`: `level A1..B2`, `topicId >= 1`; `MixedQuizStartDto`: `totalQuestions 5..40` default `20`) trong `back-end/src/modules/learning/dto/learning.dto.ts`
- [X] T025 [US2] Cài đặt `LearningService` trong `back-end/src/modules/learning/learning.service.ts`: danh sách bài học kèm `isUnlocked`, `acquisitionCompleted`, `isCompleted`, `bestScore`; `openCard(userId, lessonId, vocabularyId)` kiểm tra từ thuộc `lesson_vocabularies` và cập nhật `opened_vocabulary_ids` + `acquisition_completed`; `startLessonPractice(userId, lessonId)` kiểm tra cổng mở khóa (tôn trọng `STRICT_UNLOCK_MODE`) & `acquisition_completed`; `startMixedQuiz(userId, totalQuestions)` (trả `400 INSUFFICIENT_STUDIED_WORDS` nếu 0 từ đã học)
- [X] T026 [US2] Cài đặt `LearningController` (`GET /learning/lessons`, `POST /learning/lessons/:lessonId/cards/:vocabularyId/open`, `POST /learning/lessons/:lessonId/practice/start`, `POST /learning/quizzes/mixed/start`) trong `back-end/src/modules/learning/learning.controller.ts`

**Checkpoint**: User Story 2 hoạt động độc lập (khởi tạo học nạp & sinh khung phiên bài tập).

---

## Phase 5: User Story 3 — Sinh đề phản xạ & Chấm điểm thông minh (Priority: P1)

**Goal**: Triển khai toàn bộ thuật toán thuần (Distractor 3 tầng, Fisher-Yates Shuffle, Stratified Sampling, Damerau-Levenshtein, Soundex & Double Metaphone) và endpoint nộp bài chấm điểm (`exact` `1.0`, `near_match` `0.5` cho từ $\ge 3$ ký tự, `phonetic_match` `0.0`, `incorrect` / bỏ trống `0.0`), làm tròn half-up 2 chữ số, mở khóa bài kế tiếp và chống nộp trùng `409`.

**Independent Test**: Chạy unit test `back-end/tests/unit/algorithm/grading-and-generation.spec.ts` và integration test `back-end/tests/integration/quiz-grading.e2e-spec.ts`.

### Tests for User Story 3 (TDD — viết trước, xác nhận FAIL trước khi code) ⚠️

- [X] T027 [P] [US3] Viết unit tests thuần cho thuật toán sinh đề & chấm điểm (`US3-AS1`–`US3-AS6`: Distractor 3 tầng không trùng word/meaning, Fisher-Yates phân bố $25\% \pm 3\%$ qua 1.000 lần chạy, Stratified Sampling đều chủ đề, chuẩn hóa trim/collapse-spaces/lowercase, Damerau-Levenshtein $= 1$ trên từ $\ge 3$ ký tự vs $< 3$ ký tự, Soundex/Double Metaphone cho `phone`/`fone`, `night`/`nite`, `write`/`rite`) trong `back-end/tests/unit/algorithm/grading-and-generation.spec.ts`
- [X] T028 [P] [US3] Viết integration tests cho `POST /learning/quizzes/:attemptId/submit` (chấm điểm tổng, làm tròn half-up so sánh $\ge 80.00\%$, chuyển từ thiếu `audio_url` sang Typing/MC, từ loại hiếm $< 4$ từ, trả `403` nếu khác chủ sở hữu, `404` nếu không tồn tại, `409 ATTEMPT_ALREADY_SUBMITTED` khi nộp trùng) trong `back-end/tests/integration/quiz-grading.e2e-spec.ts`

### Implementation for User Story 3

- [X] T029 [P] [US3] Cài đặt thuật toán thuần `fisherYatesShuffle` trong `back-end/src/modules/algorithm/fisher-yates.util.ts`, `damerauLevenshteinDistance` + chuẩn hóa chuỗi trong `back-end/src/modules/algorithm/damerau-levenshtein.util.ts`, và `soundex` + `doubleMetaphone` trong `back-end/src/modules/algorithm/phonetic.util.ts`
- [X] T030 [P] [US3] Cài đặt `DistractorService` (3 tầng ưu tiên + fallback khi từ loại hiếm $< 4$ từ hoặc `audio_url` rỗng) trong `back-end/src/modules/algorithm/distractor.service.ts` và `StratifiedSamplingService` trong `back-end/src/modules/algorithm/stratified-sampling.service.ts`
- [X] T031 [US3] Tạo `SubmitQuizDto` (`answers[]`: `vocabularyId`, `userAnswer` nullable `maxLength: 100`, `responseTimeMs 0..300000`) trong `back-end/src/modules/learning/dto/submit-quiz.dto.ts`
- [X] T032 [US3] Tích hợp `DistractorService` và `StratifiedSamplingService` vào `LearningService` (`back-end/src/modules/learning/learning.service.ts`) khi sinh `questions_snapshot` cho `startLessonPractice` và `startMixedQuiz`
- [X] T033 [US3] Cài đặt `QuizGradingService` trong `back-end/src/modules/learning/quiz-grading.service.ts` (kiểm tra ownership `403`, chống nộp trùng `409`, chấm từng câu `exact`/`near_match`/`phonetic_match`/`incorrect` kể cả chuỗi trắng thành `q=0`, tính `total_score`, làm tròn half-up `score_percentage`, cập nhật `user_lesson_progress`, mở khóa bài kế & ghi `audit_logs` `LESSON_UNLOCKED`) và thêm `POST /learning/quizzes/:attemptId/submit` vào `back-end/src/modules/learning/learning.controller.ts`

**Checkpoint**: User Story 3 hoàn chỉnh, toàn bộ thuật toán sinh đề & chấm điểm pass 100% unit + integration tests.

---

## Phase 6: User Story 4 — Ôn tập dài hạn SuperMemo SM-2 và 5 Hộp Leitner (Priority: P1)

**Goal**: Tự động quy đổi kết quả chấm + `response_time_ms` (`5.000 ms` / `12.000 ms`) sang $q \in \{0..5\}$, tính công thức SuperMemo SM-2 ($EF_{min} = 1,30$, half-up), đồng bộ 5 Hộp Leitner, khóa hàng `SELECT ... FOR UPDATE` chống race condition khi nộp đồng thời, và cung cấp API ôn tập hằng ngày.

**Independent Test**: Chạy unit test `back-end/tests/unit/algorithm/sm2-leitner.spec.ts` và integration test `back-end/tests/integration/sm2-review.e2e-spec.ts`.

### Tests for User Story 4 (TDD — viết trước, xác nhận FAIL trước khi code) ⚠️

- [X] T034 [P] [US4] Viết unit tests thuần cho SM-2 & Leitner (`US4-AS1`–`US4-AS5`: quy đổi $q$ tại biên `5.000 ms` và `12.000 ms`, bỏ trống/hết giờ `q=0`, sàn $EF_{min} = 1.30$, làm tròn half-up $EF'$ và $I'$, reset $n'=0, I'=1$ khi $q < 3$, ánh xạ 5 Hộp Leitner) trong `back-end/tests/unit/algorithm/sm2-leitner.spec.ts`
- [X] T035 [P] [US4] Viết integration tests cho SM-2 & Review API (`US4-AS6`–`US4-AS7`: sắp xếp `leitner_box ASC, next_review_date ASC, id ASC`, `0 < total_due < limit`, `total_due = 0` trả `[]` ở `/reviews/due` và `400 NO_DUE_REVIEWS` ở `/reviews/session/start`, nộp đồng thời 2 kết quả cho cùng `(user_id, vocabulary_id)` áp dụng tuần tự đúng 1 lần) trong `back-end/tests/integration/sm2-review.e2e-spec.ts`

### Implementation for User Story 4

- [X] T036 [P] [US4] Cài đặt thuật toán thuần `Sm2LeitnerService` (`deriveQualityRating`, `calculateNextSm2State`, `mapRepetitionsToLeitnerBox`) trong `back-end/src/modules/algorithm/sm2-leitner.service.ts`
- [X] T037 [P] [US4] Tạo entity `UserSm2Review` trong `back-end/src/modules/review/entities/user-sm2-review.entity.ts` (`UNIQUE (user_id, vocabulary_id)`, `easiness_factor DECIMAL(4,2) >= 1.30`, `repetitions >= 0`, `interval_days >= 0`, `next_review_date DATE`, `leitner_box 1..5`, `last_quality_rating 0..5`) và Review DTOs (`ReviewsDueQueryDto`: `limit 1..50` default `20`; `StartReviewSessionDto`: `limit 1..50` default `20`) trong `back-end/src/modules/review/dto/review.dto.ts`
- [X] T038 [US4] Cài đặt `ReviewService` trong `back-end/src/modules/review/review.service.ts` (`getDueReviews`, `startReviewSession` lưu `due_count_snapshot` & sinh đề qua `DistractorService`, `applySm2UpdatesInTransaction` dùng `INSERT ... ON CONFLICT DO NOTHING` + `SELECT ... FOR UPDATE` tuần tự theo từng câu đã nộp bất kể bài học đỗ hay trượt)
- [X] T039 [US4] Cài đặt `ReviewController` (`GET /reviews/due`, `POST /reviews/session/start`) trong `back-end/src/modules/review/review.controller.ts` và nối `ReviewService.applySm2UpdatesInTransaction` vào transaction nộp bài của `QuizGradingService` (`back-end/src/modules/learning/quiz-grading.service.ts`)

**Checkpoint**: User Story 4 hoàn chỉnh, đồng bộ SM-2 & 5 Hộp Leitner hoạt động chính xác kể cả dưới tải đồng thời.

---

## Phase 7: User Story 5 — Chuỗi ngày học (Streak), Thống kê & Email nhắc nhở 20:00 (Priority: P2)

**Goal**: Ghi nhận `daily_study_logs` theo ngày `UTC+7` bằng phép cộng dồn nguyên tử, tính `current_streak` / `longest_streak`, cung cấp API thống kê 7 ngày & phân bố Leitner, và chạy Cron `20:00 UTC+7` qua Redis + BullMQ với cơ chế claim-before-enqueue chống gửi trùng + 3 lần retry + catch-up nếu trễ nhịp trong ngày.

**Independent Test**: Chạy `back-end/tests/integration/streak-and-cron.e2e-spec.ts` kiểm chứng `US5-AS1`–`US5-AS5`.

### Tests for User Story 5 (TDD — viết trước, xác nhận FAIL trước khi code) ⚠️

- [X] T040 [P] [US5] Viết integration tests cho Streak, Stats & Cron 20:00 (`US5-AS1`–`US5-AS5`: cộng streak 1 lần/ngày khi bài đạt $\ge 80,00\%$; nộp bài dưới ngưỡng `< 80,00%` không kích hoạt streak nhưng vẫn cập nhật SM-2; hoạt động lặp lại/đồng thời trong ngày cộng dồn nguyên tử `lesson_practices_completed`, `words_learned`, `words_reviewed`, `sm2_sessions_completed` không mất đếm; `0 < total_due < 10` vẫn đạt mục tiêu ngày; bỏ ngày `D-2` reset về `1` và hiển thị `0` khi truy vấn; ranh giới `23:55 -> 00:03 UTC+7`; quét `20:00` chỉ gửi đúng đối tượng, chống gửi trùng lần 2, 3 lần retry -> `failed`, và chạy bù trong ngày) trong `back-end/tests/integration/streak-and-cron.e2e-spec.ts`

### Implementation for User Story 5

- [X] T041 [P] [US5] Tạo entities `UserStreak` trong `back-end/src/modules/gamification/entities/user-streak.entity.ts` (`user_id UNIQUE`, `current_streak >= 0`, `longest_streak >= current_streak`, `last_study_date DATE NULL`) và `DailyStudyLog` trong `back-end/src/modules/gamification/entities/daily-study-log.entity.ts` (`UNIQUE (user_id, study_date)`, `words_learned`, `words_reviewed`, `lesson_practices_completed`, `sm2_sessions_completed`, `streak_qualified`, `reminder_sent`, `reminder_status`, `reminder_attempts`, `reminder_sent_at`)
- [X] T042 [US5] Cài đặt `StreakService` trong `back-end/src/modules/gamification/streak.service.ts` (`recordDailyProgressAndUpdateStreak` cộng dồn nguyên tử các cột `lesson_practices_completed`, `words_learned`, `words_reviewed`, `sm2_sessions_completed` trong transaction + `SELECT ... FOR UPDATE` tại thời điểm `submit` theo ngày `UTC+7`, chỉ tăng `current_streak` tối đa 1 lần/ngày khi `streak_qualified` chuyển `false -> true`; `getOverviewStats` trả `currentStreak` = 0 nếu `last_study_date <= hôm nay - 2 ngày`, phân bố 5 Hộp Leitner và mảng đủ 7 ngày `UTC+7`; `getAdminStats` tổng hợp hệ thống)
- [X] T043 [US5] Nối `StreakService.recordDailyProgressAndUpdateStreak` vào transaction nộp bài của `QuizGradingService` (`back-end/src/modules/learning/quiz-grading.service.ts`)
- [X] T044 [US5] Cài đặt `StatsController` (`GET /stats/overview`, `GET /admin/stats`) trong `back-end/src/modules/gamification/stats.controller.ts`
- [X] T045 [US5] Cài đặt `StreakReminderCron` trong `back-end/src/modules/gamification/streak-reminder.cron.ts` (`@Cron('0 20 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })` + kiểm tra catch-up nếu server khởi động lại sau 20:00 trong cùng ngày `UTC+7` trước `23:59`; lọc `email_reminder_enabled = true AND current_streak >= 1 AND last_study_date = hôm qua`, cập nhật nguyên tử `reminder_sent = true, reminder_status = 'queued'` trước khi enqueue BullMQ với `jobId: streak-reminder:${userId}:${studyDate}` + ghi `audit_logs` `STREAK_REMINDER_JOB`)
- [X] T046 [US5] Cài đặt `EmailQueueProcessor` (`@Processor('streak-reminder')`) trong `back-end/src/modules/gamification/email-queue.processor.ts` dùng `nodemailer` (backoff exponential 3 lần, cập nhật `reminder_attempts` và `reminder_status = 'delivered'` hoặc `'failed'` khi hết 3 lần retry, không sập worker)

**Checkpoint**: User Story 5 hoàn chỉnh, toàn bộ 5 User Stories hoạt động độc lập và liên thông.

---

## Phase 8: Polish, Observability & Performance Verification

**Purpose**: Kiểm chứng phi chức năng (log vận hành, hiệu năng `SC-006`/`SC-007`, migration `up`/`down` và E2E `quickstart.md`).

- [X] T047 [P] Bổ sung log vận hành có cấu trúc và cảnh báo ngưỡng cấu hình được (`FR-014`: $\ge 20$ lần `AUTH_LOGIN_FAILED` hoặc $\ge 5$ lần khóa rate-limit trong 5 phút; BullMQ `waiting + delayed > 500` jobs kéo dài $> 5$ phút hoặc có job `failed` sau 3 lần thử; tác vụ quét 20:00 vượt `30 giây` hoặc trễ nhịp $> 5$ phút) trong `back-end/src/modules/audit/operational-monitor.service.ts`
- [X] T048 [P] Tạo script kiểm thử hiệu năng `back-end/tests/perf/benchmark-sc006-sc007.ts` đo `p95 < 200ms` (100 kết nối đồng thời, 1.000 requests, DB $\ge 3.500$ từ) theo `SC-006`, tốc độ quét 10.000 hồ sơ `< 30 giây` theo `SC-007`, và ghi nhận thời gian thực thi chuỗi API đăng ký + tải bài + mở thẻ đầu tiên để làm cơ sở đối chiếu cho tiêu chí `SC-001` (`< 1 phút` end-to-end UX nghiệm thu thủ công/trên `004-frontend-webapp`)
- [X] T049 Chạy toàn bộ unit test & integration test (`npm test` trong `back-end/`), kiểm tra `typeorm:migration:run` và `typeorm:migration:revert` hoạt động sạch, và xác nhận các luồng E2E trong `specs/002-backend-core/quickstart.md`

---

## Phase 9: User Story 6 — Cách ly Schema, OTP Quên Mật khẩu & Đồng bộ Cá nhân / Hỗ trợ (Priority: P2)

**Goal**: Xử lý toàn bộ các hạng mục feedback phía Backend & CSDL (trừ AI Chat), chia theo đúng 6 đợt độc lập để kiểm thử và `git push` từng phần.

**Independent Test**: Kiểm tra thư mục gốc sạch `schema_postgresql_v3.sql`, chạy pass `password-reset.e2e-spec.ts` và `user-sync-support.e2e-spec.ts` trong `back-end/tests/integration/`.

- [X] T050 [US6] [Đợt 1] Di chuyển `schema_postgresql_v3.sql` sang `docs/archive/schema_postgresql_v3.sql` kèm khối cảnh báo rõ đầu tệp không nạp thủ công đè lên TypeORM migrations
- [ ] T051 [US6] [Đợt 2 - Test] Viết Integration Test cho luồng OTP Quên/Đặt lại mật khẩu (`POST /auth/forgot-password`, `POST /auth/reset-password`, giới hạn gửi mã, sai quá 5 lần, thu hồi phiên cũ) tại `back-end/tests/integration/password-reset.e2e-spec.ts`
- [ ] T052 [US6] [Đợt 2] Bổ sung `ForgotPasswordDto`, `ResetPasswordDto`, logic OTP SHA-256 trên Redis (TTL 10 phút) + gửi mail qua `nodemailer` và thu hồi phiên trong `back-end/src/modules/auth/`
- [ ] T053 [US6] [Đợt 3 - Test] Viết Integration Test cho API Lịch sử học tập (`GET /learning/history` phân trang + chi tiết từng từ + cô lập theo `userId`) tại `back-end/tests/integration/user-sync-support.e2e-spec.ts`
- [ ] T054 [US6] [Đợt 3] Cài đặt `GET /learning/history` đọc từ `quiz_attempts` và `quiz_attempt_answers` trong `back-end/src/modules/learning/learning.controller.ts` & `learning.service.ts`
- [ ] T055 [US6] [Đợt 4] Tạo migration `back-end/src/database/migrations/1700000000003-CreateUserSyncAndSupportTables.ts` (4 bảng `user_saved_words`, `user_notifications`, `support_messages`, `support_tickets`) và đăng ký trong `back-end/src/config/database.config.ts`
- [ ] T056 [US6] [Đợt 4] Bổ sung test + cài đặt API Sổ từ đã lưu (`GET /vocabularies/saved`, `POST /vocabularies/:id/save`, `DELETE /vocabularies/:id/save`) trong `back-end/src/modules/vocabulary/` và `back-end/tests/integration/user-sync-support.e2e-spec.ts`
- [ ] T057 [US6] [Đợt 5] Bổ sung test + cài đặt module `NotificationsModule` (`/notifications`, `/:id/read`, `/read-all`, xóa thông báo, tự động tạo thông báo khi nộp bài thực hành) tại `back-end/src/modules/notifications/` và đăng ký vào `back-end/src/app.module.ts`
- [ ] T058 [US6] [Đợt 6] Bổ sung test + cài đặt module `SupportModule` (`/support/messages`, `/support/tickets`, `/admin/support/threads`, `/admin/support/tickets/:id/reply` kèm đẩy thông báo & ghi `audit_logs`) tại `back-end/src/modules/support/` và đăng ký vào `back-end/src/app.module.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Bắt đầu ngay.
- **Phase 2 (Foundational)**: Phụ thuộc Phase 1 — **BLOCK** toàn bộ `US1`–`US5`.
- **Phase 3 (`US1` - P1 🎯 MVP)**: Phụ thuộc Phase 2. Viết & chạy `T011` (Red) **trước** khi triển khai `T012`–`T020` (Green).
- **Phase 4 (`US2` - P1)**: Phụ thuộc Phase 2 & `User` entity từ Phase 3 (`T012`). Viết & chạy `T021` (Red) **trước** `T022`–`T026`.
- **Phase 5 (`US3` - P1)**: Viết & chạy `T027` (Unit Red) và `T028` (Integration Red) **trước** khi triển khai; cụ thể `T029`, `T030` chờ `T027` Red, còn `T031`–`T033` (`QuizGradingService`) chờ cả `T028` Red lẫn `T023`, `T025`.
- **Phase 6 (`US4` - P1)**: Viết & chạy `T034` (Unit Red) và `T035` (Integration Red) **trước** khi triển khai; cụ thể `T036` chờ `T034` Red, còn `T037`–`T039` (`ReviewService` & tích hợp `QuizGradingService`) chờ cả `T035` Red lẫn `T033`.
- **Phase 7 (`US5` - P2)**: Phụ thuộc `T012` (`User`), `T033` (`QuizGradingService`), `T038` (`ReviewService`). Viết & chạy `T040` (Red) **trước** `T041`–`T046`.
- **Phase 8 (Polish)**: Phụ thuộc `US1`–`US5`.

### Parallel Opportunities

- **Phase 1**: `T002`, `T003`, `T004` chạy song song sau `T001`.
- **Phase 2**: `T006`, `T007`, `T008`, `T009` chạy song song sau `T005`.
- **Phase 3 (`US1`)**: **Sau khi `T011` đã chạy và FAIL (Red)**, `T012`, `T013`, `T014`, `T015` chạy song song.
- **Phase 5 (`US3`) & Phase 6 (`US4`)**: Sau Phase 2, viết & chạy song song toàn bộ bộ test TDD của `US3` + `US4` (`T027`, `T028`, `T034`, `T035`) ở Wave 1 (xác nhận Red); **sau khi Wave 1 đã Red**, triển khai song song các thuật toán thuần (`T029`, `T030`, `T036`) ở Wave 2 (Green).

---

## Parallel Example: Thuật toán thuần (`US3` + `US4`) theo TDD Red $\rightarrow$ Green

```bash
# Wave 1 (TDD Red — chạy trước cả unit lẫn integration tests, xác nhận FAIL):
Task: T027 [US3] Unit tests trong back-end/tests/unit/algorithm/grading-and-generation.spec.ts
Task: T028 [US3] Integration tests trong back-end/tests/integration/quiz-grading.e2e-spec.ts
Task: T034 [US4] Unit tests trong back-end/tests/unit/algorithm/sm2-leitner.spec.ts
Task: T035 [US4] Integration tests trong back-end/tests/integration/sm2-review.e2e-spec.ts

# Wave 2 (TDD Green — chạy song song SAU KHI Wave 1 đã FAIL):
Task: T029 [US3] Pure utils fisher-yates, damerau-levenshtein, phonetic trong back-end/src/modules/algorithm/
Task: T030 [US3] DistractorService & StratifiedSamplingService trong back-end/src/modules/algorithm/
Task: T036 [US4] Pure Sm2LeitnerService trong back-end/src/modules/algorithm/sm2-leitner.service.ts
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Hoàn thành Phase 1 (Setup) + Phase 2 (Foundational).
2. Hoàn thành Phase 3 (`US1`: Auth, Google OAuth, Refresh Rotation, Profile, Admin).
3. **STOP & VALIDATE**: Chạy `auth-users.e2e-spec.ts` để xác nhận toàn bộ luồng bảo mật & phiên hoạt động độc lập.

### Incremental Delivery

1. `Setup + Foundational` $\rightarrow$ Nền tảng DB & Guard sẵn sàng.
2. `US1` $\rightarrow$ Xác thực & phân quyền hoàn chỉnh (MVP).
3. `US2` $\rightarrow$ Chu trình Học nạp $\rightarrow$ Học áp dụng & Cổng mở khóa.
4. `US3` $\rightarrow$ Sinh đề phản xạ & Chấm điểm thông minh (Damerau + Soundex/Double Metaphone).
5. `US4` $\rightarrow$ Ôn tập SM-2 & 5 Hộp Leitner đồng bộ concurrency-safe.
6. `US5` $\rightarrow$ Streak, Thống kê 7 ngày & Cron nhắc nhở 20:00 qua BullMQ.
7. `Polish` $\rightarrow$ Operational monitoring & Benchmark `SC-006`/`SC-007`.
