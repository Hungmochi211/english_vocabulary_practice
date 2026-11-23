# Data Model & Database Schema: 002-backend-core

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Branch**: `002-backend-core`

Tài liệu này định nghĩa mô hình cơ sở dữ liệu PostgreSQL 16+ cho phân hệ Lõi Backend (`002-backend-core`), mở rộng nối tiếp trên các bảng nền móng (`topics`, `vocabularies`, `lessons`, `lesson_vocabularies`) của **Feature `001-vocabulary-data`**.

**Quy ước thiết kế chung:**
- Mã hóa `UTF-8`, múi giờ hệ thống `TIMESTAMPTZ` (ngày lịch học/ôn tập tính theo `Asia/Ho_Chi_Minh`, `UTC+7`).
- Khóa chính `INT GENERATED ALWAYS AS IDENTITY`.
- Bảo vệ đồng thời cho SM-2 & Streak bằng transaction + `SELECT ... FOR UPDATE`.

---

## 1. Sơ đồ Quan hệ Thực thể (Relationship Map)

```text
users (1) ──┬──< (n) refresh_sessions
            ├──< (n) user_lesson_progress (n) >── (1) lessons [từ 001]
            ├──< (n) quiz_attempts ──< (n) quiz_attempt_answers >── (1) vocabularies [từ 001]
            ├──< (n) user_sm2_reviews (n) >── (1) vocabularies [từ 001]
            ├─── (1) user_streaks
            ├──< (n) daily_study_logs
            └──< (n) audit_logs
```

---

## 2. Chi tiết Thực thể (9 Bảng)

### 2.1. `users` (Người dùng)

| Cột | Kiểu | Nullable | Ràng buộc / Quy tắc | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | ❌ | `PRIMARY KEY IDENTITY` | Định danh người dùng |
| `email` | `VARCHAR(255)` | ❌ | `UNIQUE`, luôn lưu `LOWER(TRIM(email))` | Email đăng nhập (FR-002) |
| `password_hash` | `VARCHAR(255)` | ✔️ | Băm `bcrypt` (salt $\ge 10$); NULL nếu chỉ dùng Google | Mật khẩu băm |
| `full_name` | `VARCHAR(100)` | ❌ | 1–100 ký tự | Họ tên hiển thị |
| `avatar_url` | `VARCHAR(500)` | ✔️ | URL hợp lệ hoặc NULL | Ảnh đại diện |
| `target_level` | `cefr_level_enum` | ❌ | `DEFAULT 'B1'` | Mục tiêu CEFR (`A1`–`B2`) |
| `role` | `user_role_enum` | ❌ | `DEFAULT 'learner'` (`learner`, `admin`) | Phân quyền (FR-001) |
| `auth_provider` | `auth_provider_enum` | ❌ | `DEFAULT 'local'` (`local`, `google`) | Nguồn tạo tài khoản |
| `google_id` | `VARCHAR(100)` | ✔️ | `UNIQUE` | Google sub ID sau khi xác thực |
| `email_reminder_enabled` | `BOOLEAN` | ❌ | `DEFAULT TRUE` | Bật/tắt email nhắc lúc 20:00 |
| `token_version` | `INT` | ❌ | `DEFAULT 1`, $\ge 1$ | Tăng lên khi đổi mật khẩu để thu hồi mọi Access Token |
| `is_active` | `BOOLEAN` | ❌ | `DEFAULT TRUE` | Trạng thái hoạt động |
| `created_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Ngày tạo |
| `updated_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Cập nhật cuối |

### 2.2. `refresh_sessions` (Phiên làm mới)

| Cột | Kiểu | Nullable | Ràng buộc / Quy tắc | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | ❌ | `PRIMARY KEY IDENTITY` | Định danh bản ghi |
| `user_id` | `INT` | ❌ | `FK -> users(id) ON DELETE CASCADE` | Chủ sở hữu phiên |
| `session_family_id` | `UUID` | ❌ | Sinh mới mỗi lần login | Nhóm phiên phục vụ Reuse Detection (FR-003) |
| `token_hash` | `CHAR(64)` | ❌ | `UNIQUE` | SHA-256 hex của Refresh Token |
| `replaced_by_hash` | `CHAR(64)` | ✔️ | `NULL` khi đang hiệu lực | Hash của token mới đã xoay vòng thay thế |
| `is_revoked` | `BOOLEAN` | ❌ | `DEFAULT FALSE` | `TRUE` khi đã logout hoặc thu hồi family |
| `revoked_at` | `TIMESTAMPTZ` | ✔️ | `NULL` | Thời điểm thu hồi |
| `user_agent` | `VARCHAR(255)` | ✔️ | `NULL` | Thông tin thiết bị cơ bản |
| `ip_address` | `VARCHAR(45)` | ✔️ | `NULL` | IPv4 / IPv6 lúc cấp phiên |
| `expires_at` | `TIMESTAMPTZ` | ❌ | `expires_at > created_at` | Thời điểm hết hạn (7 ngày) |
| `created_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Thời điểm cấp phát |

### 2.3. `user_lesson_progress` (Tiến độ Bài học)

| Cột | Kiểu | Nullable | Ràng buộc / Quy tắc | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | ❌ | `PRIMARY KEY IDENTITY` | Khóa chính |
| `user_id` | `INT` | ❌ | `FK -> users(id) ON DELETE CASCADE` | Học viên |
| `lesson_id` | `INT` | ❌ | `FK -> lessons(id) ON DELETE CASCADE` | Bài học thuộc `001` |
| `opened_vocabulary_ids` | `INT[]` | ❌ | `DEFAULT '{}'` | Danh sách ID từ đã mở ở Bước 1 (FR-004) |
| `acquisition_completed` | `BOOLEAN` | ❌ | `DEFAULT FALSE` | `TRUE` khi đã mở đủ 100% từ của bài học |
| `is_completed` | `BOOLEAN` | ❌ | `DEFAULT FALSE` | `TRUE` khi đạt $\ge 80.00\%$ (không thu hồi nếu làm lại điểm thấp) |
| `best_score` | `DECIMAL(5,2)` | ❌ | `0.00 <= best_score <= 100.00` | Điểm % cao nhất từng đạt |
| `attempts_count` | `INT` | ❌ | `DEFAULT 0`, $\ge 0$ | Số lần đã nộp bài tập |
| `first_completed_at` | `TIMESTAMPTZ` | ✔️ | `NULL` | Mốc hoàn thành $\ge 80\%$ lần đầu |
| `updated_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Cập nhật cuối |

**Ràng buộc:** `UNIQUE (user_id, lesson_id)`.

### 2.4. `quiz_attempts` (Phiên / Lượt làm bài tập)

| Cột | Kiểu | Nullable | Ràng buộc / Quy tắc | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | ❌ | `PRIMARY KEY IDENTITY` | Định danh lượt làm bài |
| `user_id` | `INT` | ❌ | `FK -> users(id) ON DELETE CASCADE` | Học viên |
| `lesson_id` | `INT` | ✔️ | `FK -> lessons(id) ON DELETE SET NULL` | NULL nếu là `sm2_review` hoặc `mixed_quiz` |
| `attempt_type` | `quiz_attempt_type_enum` | ❌ | `lesson_practice`, `sm2_review`, `mixed_quiz` | Phân loại phiên luyện tập |
| `status` | `quiz_attempt_status_enum` | ❌ | `in_progress`, `submitted` | Chống nộp trùng cùng một phiên |
| `questions_snapshot` | `JSONB` | ❌ | Lưu đề bài server đã sinh | Chống client sửa câu hỏi/đáp án |
| `due_count_snapshot` | `INT` | ✔️ | NULL hoặc $\ge 0$ | Tổng số từ đến hạn lúc bắt đầu phiên `sm2_review` (phục vụ kiểm tra Streak FR-012) |
| `total_questions` | `INT` | ❌ | $> 0$ | Tổng số câu hỏi |
| `total_score` | `DECIMAL(6,2)` | ❌ | `DEFAULT 0.00` | Tổng điểm ($1,0$ + $0,5$ + $0,0$) |
| `score_percentage` | `DECIMAL(5,2)` | ❌ | `0.00..100.00` | Tỷ lệ % đạt được |
| `started_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Bắt đầu làm bài |
| `submitted_at` | `TIMESTAMPTZ` | ✔️ | `NULL` | Thời điểm nộp bài |

### 2.5. `quiz_attempt_answers` (Chi tiết từng câu trả lời)

| Cột | Kiểu | Nullable | Ràng buộc / Quy tắc | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | ❌ | `PRIMARY KEY IDENTITY` | Khóa chính |
| `attempt_id` | `INT` | ❌ | `FK -> quiz_attempts(id) ON DELETE CASCADE` | Lượt làm bài |
| `user_id` | `INT` | ❌ | `FK -> users(id) ON DELETE CASCADE` | Học viên |
| `vocabulary_id` | `INT` | ❌ | `FK -> vocabularies(id) ON DELETE RESTRICT` | Từ vựng được hỏi |
| `practice_mode` | `practice_mode_enum` | ❌ | `multiple_choice`, `typing`, `dictation` | Dạng bài tập (FR-006) |
| `user_answer` | `TEXT` | ✔️ | NULL nếu bỏ trống | Câu trả lời của học viên |
| `grading_status` | `grading_status_enum` | ❌ | `exact`, `near_match`, `phonetic_match`, `incorrect` | Phân loại kết quả (FR-007) |
| `score` | `DECIMAL(3,2)` | ❌ | `1.00`, `0.50`, `0.00` | Điểm từng câu |
| `damerau_distance` | `INT` | ✔️ | NULL với trắc nghiệm | Khoảng cách Damerau-Levenshtein |
| `soundex_matched` | `BOOLEAN` | ✔️ | NULL nếu không phải Dictation | Trùng mã Soundex / Double Metaphone |
| `quality_rating` | `SMALLINT` | ❌ | `0..5` | Điểm nhớ $q$ suy ra cho SM-2 (FR-008) |
| `response_time_ms` | `INT` | ❌ | `0..300000` | Thời gian phản hồi (ms) |
| `created_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Thời điểm chấm |

### 2.6. `user_sm2_reviews` (Hồ sơ Ôn tập SM-2 & Hộp Leitner)

| Cột | Kiểu | Nullable | Ràng buộc / Quy tắc | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | ❌ | `PRIMARY KEY IDENTITY` | Khóa chính |
| `user_id` | `INT` | ❌ | `FK -> users(id) ON DELETE CASCADE` | Học viên |
| `vocabulary_id` | `INT` | ❌ | `FK -> vocabularies(id) ON DELETE RESTRICT` | Từ vựng đang theo dõi |
| `easiness_factor` | `DECIMAL(4,2)` | ❌ | `DEFAULT 2.50`, $\ge 1.30$ | Hệ số độ dễ $EF$ (FR-009) |
| `repetitions` | `INT` | ❌ | `DEFAULT 0`, $\ge 0$ | Số lần nhớ liên tiếp $n$ |
| `interval_days` | `INT` | ❌ | `DEFAULT 0`, $\ge 0$ | Chu kỳ ngày $I$ |
| `next_review_date` | `DATE` | ❌ | Bắt buộc (theo `UTC+7`) | Ngày đến hạn ôn tiếp theo |
| `leitner_box` | `SMALLINT` | ❌ | `DEFAULT 1`, `1..5` | Đồng bộ 1-1 với `repetitions` (FR-010) |
| `last_quality_rating` | `SMALLINT` | ✔️ | `0..5` | Điểm $q$ lần gần nhất |
| `last_reviewed_at` | `TIMESTAMPTZ` | ✔️ | `NULL` | Lần ôn gần nhất |
| `created_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Khởi tạo |
| `updated_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Cập nhật cuối |

**Ràng buộc:** `UNIQUE (user_id, vocabulary_id)` và `CHECK (leitner_box = CASE WHEN repetitions = 0 THEN 1 WHEN repetitions = 1 THEN 2 WHEN repetitions = 2 THEN 3 WHEN repetitions IN (3, 4) THEN 4 ELSE 5 END)`.

### 2.7. `user_streaks` (Chuỗi ngày học)

| Cột | Kiểu | Nullable | Ràng buộc / Quy tắc | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | ❌ | `PRIMARY KEY IDENTITY` | Khóa chính |
| `user_id` | `INT` | ❌ | `UNIQUE, FK -> users(id) ON DELETE CASCADE` | Quan hệ 1:1 |
| `current_streak` | `INT` | ❌ | `DEFAULT 0`, $\ge 0$ | Chuỗi hiện tại (FR-012) |
| `longest_streak` | `INT` | ❌ | `DEFAULT 0`, $\ge current\_streak$ | Kỷ lục cao nhất |
| `last_study_date` | `DATE` | ✔️ | `NULL` | Ngày đạt mục tiêu gần nhất (`UTC+7`) |
| `updated_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Cập nhật cuối |

### 2.8. `daily_study_logs` (Nhật ký học tập theo ngày `UTC+7`)

| Cột | Kiểu | Nullable | Ràng buộc / Quy tắc | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | ❌ | `PRIMARY KEY IDENTITY` | Khóa chính |
| `user_id` | `INT` | ❌ | `FK -> users(id) ON DELETE CASCADE` | Học viên |
| `study_date` | `DATE` | ❌ | Ngày theo `Asia/Ho_Chi_Minh` | Ngày học |
| `words_learned` | `INT` | ❌ | `DEFAULT 0`, $\ge 0$ | Số từ học bài mới trong ngày |
| `words_reviewed` | `INT` | ❌ | `DEFAULT 0`, $\ge 0$ | Số lượt ôn tập SM-2 trong ngày |
| `lesson_practices_completed` | `INT` | ❌ | `DEFAULT 0`, $\ge 0$ | Số bài tập bài học đã nộp trong ngày |
| `sm2_sessions_completed` | `INT` | ❌ | `DEFAULT 0`, $\ge 0$ | Số phiên ôn SM-2 đạt điều kiện ngày |
| `streak_qualified` | `BOOLEAN` | ❌ | `DEFAULT FALSE` | Đã đạt chuẩn tính Streak ngày này |
| `reminder_sent` | `BOOLEAN` | ❌ | `DEFAULT FALSE` | Cờ compare-and-set chống gửi trùng email 20:00 |
| `reminder_sent_at` | `TIMESTAMPTZ` | ✔️ | `NULL` | Thời điểm claim gửi email |
| `created_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Tạo bản ghi |
| `updated_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Cập nhật cuối |

**Ràng buộc:** `UNIQUE (user_id, study_date)`.

### 2.9. `audit_logs` (Nhật ký hệ thống)

| Cột | Kiểu | Nullable | Ràng buộc / Quy tắc | Mô tả |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `INT` | ❌ | `PRIMARY KEY IDENTITY` | Khóa chính |
| `actor_user_id` | `INT` | ✔️ | `FK -> users(id) ON DELETE SET NULL` | NULL nếu khách ẩn danh / login fail chưa xác định |
| `action` | `VARCHAR(80)` | ❌ | `AUTH_REGISTER`, `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`, `AUTH_LOGOUT`, `AUTH_PASSWORD_CHANGED`, `AUTH_REUSE_DETECTED`, `LESSON_UNLOCKED`, `STREAK_REMINDER_JOB` | Tên sự kiện (FR-014) |
| `target_type` | `VARCHAR(50)` | ✔️ | `user`, `lesson`, `session`, `cron` | Đối tượng tác động |
| `target_id` | `VARCHAR(100)` | ✔️ | Định danh đối tượng | ID đối tượng |
| `status` | `VARCHAR(20)` | ❌ | `SUCCESS`, `FAILED` | Kết quả |
| `metadata` | `JSONB` | ✔️ | Tuyệt đối không chứa password/token rõ | Ngữ cảnh bổ sung |
| `ip_address` | `VARCHAR(45)` | ✔️ | `NULL` | IP thực hiện |
| `created_at` | `TIMESTAMPTZ` | ❌ | `DEFAULT NOW()` | Thời điểm ghi |

---

## 3. Chuyển đổi Trạng thái (State Transitions)

1. **Vòng đời Bài học (`user_lesson_progress`)**:
   - `order_index = 1`: Khả dụng ngay (*Mở khóa*).
   - `Chưa xong Học nạp` (`acquisition_completed = false`) $\xrightarrow{\text{mở đủ } 100\% \text{ thẻ từ}}$ `Sẵn sàng làm bài tập` (`acquisition_completed = true`).
   - `Chưa hoàn thành` $\xrightarrow{\text{nộp bài } \ge 80.00\%}$ `Đã hoàn thành` (`is_completed = true`) + **mở khóa bài `order_index + 1`**. (Các lần làm lại sau $< 80\%$ không làm mất trạng thái `is_completed = true`).
2. **Vòng đời Thẻ nhớ (`user_sm2_reviews`)**:
   - Chưa có bản ghi $\xrightarrow{\text{lần chấm đầu tiên}}$ Khởi tạo $EF = 2.50, n = 0, I = 0$ rồi áp dụng ngay công thức SM-2.
   - Bất kỳ lượt ôn nào có $q < 3$ $\rightarrow$ `repetitions = 0, interval_days = 1, leitner_box = 1`.
   - Lượt ôn $q \ge 3$ $\rightarrow$ `repetitions += 1`, tăng `interval_days` và thăng cấp `leitner_box` tương ứng tới tối đa Hộp 5.

---

## 4. Schema DDL Migration Script (PostgreSQL 16+)

```sql
-- Các kiểu ENUM mới cho 002-backend-core (cefr_level_enum đã có từ 001)
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('learner', 'admin');
    CREATE TYPE auth_provider_enum AS ENUM ('local', 'google');
    CREATE TYPE quiz_attempt_type_enum AS ENUM ('lesson_practice', 'sm2_review', 'mixed_quiz');
    CREATE TYPE quiz_attempt_status_enum AS ENUM ('in_progress', 'submitted');
    CREATE TYPE practice_mode_enum AS ENUM ('multiple_choice', 'typing', 'dictation');
    CREATE TYPE grading_status_enum AS ENUM ('exact', 'near_match', 'phonetic_match', 'incorrect');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. users
CREATE TABLE users (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    full_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500) NULL,
    target_level cefr_level_enum NOT NULL DEFAULT 'B1',
    role user_role_enum NOT NULL DEFAULT 'learner',
    auth_provider auth_provider_enum NOT NULL DEFAULT 'local',
    google_id VARCHAR(100) NULL UNIQUE,
    email_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    token_version INT NOT NULL DEFAULT 1 CHECK (token_version >= 1),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_users_email_lower CHECK (email = LOWER(email)),
    CONSTRAINT chk_users_auth_method CHECK (password_hash IS NOT NULL OR google_id IS NOT NULL)
);

-- 2. refresh_sessions
CREATE TABLE refresh_sessions (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_family_id UUID NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    replaced_by_hash CHAR(64) NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ NULL,
    user_agent VARCHAR(255) NULL,
    ip_address VARCHAR(45) NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_refresh_expiry CHECK (expires_at > created_at)
);
CREATE INDEX idx_refresh_user_family ON refresh_sessions (user_id, session_family_id);
CREATE INDEX idx_refresh_expires_at ON refresh_sessions (expires_at);

-- 3. user_lesson_progress
CREATE TABLE user_lesson_progress (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    opened_vocabulary_ids INT[] NOT NULL DEFAULT '{}',
    acquisition_completed BOOLEAN NOT NULL DEFAULT FALSE,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    best_score DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (best_score BETWEEN 0.00 AND 100.00),
    attempts_count INT NOT NULL DEFAULT 0 CHECK (attempts_count >= 0),
    first_completed_at TIMESTAMPTZ NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_lesson_progress UNIQUE (user_id, lesson_id),
    CONSTRAINT chk_lesson_completed_gate CHECK (
        NOT is_completed OR (acquisition_completed AND best_score >= 80.00 AND first_completed_at IS NOT NULL)
    )
);

-- 4. quiz_attempts
CREATE TABLE quiz_attempts (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INT NULL REFERENCES lessons(id) ON DELETE SET NULL,
    attempt_type quiz_attempt_type_enum NOT NULL,
    status quiz_attempt_status_enum NOT NULL DEFAULT 'in_progress',
    questions_snapshot JSONB NOT NULL,
    due_count_snapshot INT NULL CHECK (due_count_snapshot IS NULL OR due_count_snapshot >= 0),
    total_questions INT NOT NULL CHECK (total_questions > 0),
    total_score DECIMAL(6,2) NOT NULL DEFAULT 0.00 CHECK (total_score >= 0.00 AND total_score <= total_questions),
    score_percentage DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (score_percentage BETWEEN 0.00 AND 100.00),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ NULL
);
CREATE INDEX idx_quiz_attempts_user_lesson ON quiz_attempts (user_id, lesson_id, status);

-- 5. quiz_attempt_answers
CREATE TABLE quiz_attempt_answers (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    attempt_id INT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vocabulary_id INT NOT NULL REFERENCES vocabularies(id) ON DELETE RESTRICT,
    practice_mode practice_mode_enum NOT NULL,
    user_answer TEXT NULL,
    grading_status grading_status_enum NOT NULL,
    score DECIMAL(3,2) NOT NULL CHECK (score IN (0.00, 0.50, 1.00)),
    damerau_distance INT NULL CHECK (damerau_distance IS NULL OR damerau_distance >= 0),
    soundex_matched BOOLEAN NULL,
    quality_rating SMALLINT NOT NULL CHECK (quality_rating BETWEEN 0 AND 5),
    response_time_ms INT NOT NULL CHECK (response_time_ms BETWEEN 0 AND 300000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_attempt_answers_user_vocab ON quiz_attempt_answers (user_id, vocabulary_id, created_at DESC);

-- 6. user_sm2_reviews
CREATE TABLE user_sm2_reviews (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vocabulary_id INT NOT NULL REFERENCES vocabularies(id) ON DELETE RESTRICT,
    easiness_factor DECIMAL(4,2) NOT NULL DEFAULT 2.50 CHECK (easiness_factor >= 1.30),
    repetitions INT NOT NULL DEFAULT 0 CHECK (repetitions >= 0),
    interval_days INT NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
    next_review_date DATE NOT NULL,
    leitner_box SMALLINT NOT NULL DEFAULT 1 CHECK (leitner_box BETWEEN 1 AND 5),
    last_quality_rating SMALLINT NULL CHECK (last_quality_rating BETWEEN 0 AND 5),
    last_reviewed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sm2_user_vocab UNIQUE (user_id, vocabulary_id),
    CONSTRAINT chk_sm2_leitner_sync CHECK (
        leitner_box = CASE
            WHEN repetitions = 0 THEN 1
            WHEN repetitions = 1 THEN 2
            WHEN repetitions = 2 THEN 3
            WHEN repetitions IN (3, 4) THEN 4
            ELSE 5
        END
    )
);
CREATE INDEX idx_sm2_due ON user_sm2_reviews (user_id, next_review_date, leitner_box, id);

-- 7. user_streaks
CREATE TABLE user_streaks (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    current_streak INT NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
    longest_streak INT NOT NULL DEFAULT 0 CHECK (longest_streak >= current_streak),
    last_study_date DATE NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_streaks_reminder_scan ON user_streaks (current_streak, last_study_date) WHERE current_streak >= 1;

-- 8. daily_study_logs
CREATE TABLE daily_study_logs (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    study_date DATE NOT NULL,
    words_learned INT NOT NULL DEFAULT 0 CHECK (words_learned >= 0),
    words_reviewed INT NOT NULL DEFAULT 0 CHECK (words_reviewed >= 0),
    lesson_practices_completed INT NOT NULL DEFAULT 0 CHECK (lesson_practices_completed >= 0),
    sm2_sessions_completed INT NOT NULL DEFAULT 0 CHECK (sm2_sessions_completed >= 0),
    streak_qualified BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_sent_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_daily_study_log UNIQUE (user_id, study_date)
);

-- 9. audit_logs
CREATE TABLE audit_logs (
    id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    target_type VARCHAR(50) NULL,
    target_id VARCHAR(100) NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('SUCCESS', 'FAILED')),
    metadata JSONB NULL,
    ip_address VARCHAR(45) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_actor_created ON audit_logs (actor_user_id, created_at DESC);
```
