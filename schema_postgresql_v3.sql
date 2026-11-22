-- ============================================================================
-- SCHEMA CƠ SỞ DỮ LIỆU POSTGRESQL 16+ & PGVECTOR — BẢN HỢP NHẤT v3.2 (FINAL)
-- Dự án: Website Hỗ trợ Học Từ Vựng Tiếng Anh Thông Minh (Oxford 3000 - B1+)
-- Đơn vị: Nhóm 51 - Lớp K68CNTTF - Khoa CNTT - Học viện Nông nghiệp Việt Nam
--
-- Tổng quan: 5 Phân hệ - 19 Bảng thực thể - 14 ENUMs - 10 Triggers updated_at
-- Môi trường: PostgreSQL 16+ (Docker image: pgvector/pgvector:pg16)
-- Lưu ý vận hành:
--   1. Chạy script trên CSDL mới (fresh DB) bằng quyền owner/migration role.
--   2. Trên TypeORM đặt synchronize: false, quản lý thay đổi bằng migrations.
--   3. Quy tắc ánh xạ repetitions <-> leitner_box (spec002) được kiểm soát
--      tập trung tại tầng NestJS Service kèm Unit Test để dễ bảo trì.
--   4. Redis + BullMQ đảm nhiệm: token quên mật khẩu/xác minh email (TTL + GETDEL),
--      trạng thái QTV online, job parse file Excel/DOCX/TXT tạm (đối chiếu kho
--      Oxford rồi trả preview), và hàng đợi gửi/retry email.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. KHỞI TẠO EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 2. KHỞI TẠO CÁC KIỂU ENUM NGUYÊN BẢN (14 ENUMS)
-- ============================================================================
CREATE TYPE user_role_enum            AS ENUM ('learner', 'admin');
CREATE TYPE auth_provider_enum        AS ENUM ('local', 'google');
CREATE TYPE cefr_level_enum           AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
CREATE TYPE deck_cefr_level_enum      AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'all');
CREATE TYPE deck_type_enum            AS ENUM ('system_lesson', 'custom_deck');
CREATE TYPE progress_status_enum      AS ENUM ('new', 'learning', 'reviewing', 'mastered');
CREATE TYPE session_type_enum         AS ENUM ('lesson_study', 'lesson_practice', 'sm2_review', 'mixed_quiz');
CREATE TYPE practice_mode_enum        AS ENUM (
    'flashcard',
    'multiple_choice',
    'translation_typing',
    'dictation_listening',
    'cloze_test'
);
CREATE TYPE grading_status_enum       AS ENUM ('exact', 'near_match', 'phonetic_match', 'incorrect');
CREATE TYPE badge_condition_type_enum AS ENUM ('streak', 'words_count', 'perfect_score');
CREATE TYPE chat_type_enum            AS ENUM ('ai_assistant', 'admin_support');
CREATE TYPE chat_status_enum          AS ENUM ('open', 'closed');
CREATE TYPE chat_sender_enum          AS ENUM ('user', 'assistant', 'admin');
CREATE TYPE ai_feedback_type_enum     AS ENUM (
    'grammar_check',
    'explanation',
    'example_generation',
    'general'
);

-- ============================================================================
-- 3. HÀM TRIGGER TỰ ĐỘNG CẬP NHẬT CỘT updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. PHÂN HỆ 1: NGƯỜI DÙNG & XÁC THỰC (3 BẢNG)
-- ============================================================================

-- Bảng 1: users (Hỗ trợ Account Linking Local + Google & chuẩn hóa email thường)
CREATE TABLE users (
    id                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email             VARCHAR(191)       NOT NULL UNIQUE,
    password_hash     VARCHAR(255)       NULL,
    full_name         VARCHAR(100)       NOT NULL,
    timezone          VARCHAR(64)        NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    avatar_url        VARCHAR(500)       NULL,
    role              user_role_enum     NOT NULL DEFAULT 'learner',
    auth_provider     auth_provider_enum NOT NULL DEFAULT 'local',
    google_id         VARCHAR(100)       NULL UNIQUE,
    email_verified_at TIMESTAMPTZ        NULL,
    is_active         BOOLEAN            NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_users_has_auth_method CHECK (
        password_hash IS NOT NULL OR google_id IS NOT NULL
    ),
    CONSTRAINT chk_users_email_lower CHECK (email = LOWER(email))
);

-- Bảng 2: user_profiles (1:1 với users)
CREATE TABLE user_profiles (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id               INT             NOT NULL UNIQUE
                                          REFERENCES users(id) ON DELETE CASCADE,
    phone                 VARCHAR(20)     NULL,
    date_of_birth         DATE            NULL,
    target_level          cefr_level_enum NOT NULL DEFAULT 'B1',
    daily_target_words    INT             NOT NULL DEFAULT 15,
    strict_unlock_enabled BOOLEAN         NOT NULL DEFAULT TRUE,
    updated_at            TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_profile_daily_target CHECK (daily_target_words > 0)
);

-- Lưu ý: Token quên mật khẩu & xác minh email lưu trên Redis (SHA-256 key + TTL, dùng 1 lần qua GETDEL).

-- Bảng 3: refresh_tokens (Refresh Token Rotation & thu hồi phiên)
CREATE TABLE refresh_tokens (
    id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash CHAR(64)    NOT NULL UNIQUE,
    is_revoked BOOLEAN     NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_refresh_tokens_expiry CHECK (expires_at > created_at)
);

-- ============================================================================
-- 5. PHÂN HỆ 2: TỪ ĐIỂN, BÀI HỌC LỘ TRÌNH & VECTOR RAG (5 BẢNG)
-- ============================================================================

-- Bảng 4: topics (16 chủ đề chuẩn hóa Oxford 3000)
CREATE TABLE topics (
    id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    slug        VARCHAR(120) NOT NULL UNIQUE,
    description TEXT         NULL,
    image_url   VARCHAR(500) NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Bảng 5: vocabularies (3.813 từ vựng chuẩn hóa Oxford 3000 A1-B2, sẵn sàng mở rộng C1-C2)
CREATE TABLE vocabularies (
    id                 INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    word               VARCHAR(100)    NOT NULL,
    cefr_level         cefr_level_enum NOT NULL,
    part_of_speech     VARCHAR(30)     NOT NULL,
    sense_number       SMALLINT        NOT NULL DEFAULT 1,
    phonetic           VARCHAR(100)    NOT NULL,
    stress_syllable    SMALLINT        NULL,
    audio_url          VARCHAR(500)    NULL,
    is_active          BOOLEAN         NOT NULL DEFAULT TRUE,
    vietnamese_meaning TEXT            NOT NULL,
    example_en         TEXT            NOT NULL,
    example_vi         TEXT            NOT NULL,
    topic_id           INT             NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
    created_at         TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_vocab_natural_key
        UNIQUE (word, cefr_level, part_of_speech, sense_number),
    CONSTRAINT chk_vocab_sense_number CHECK (sense_number >= 1),
    CONSTRAINT chk_vocab_stress CHECK (stress_syllable IS NULL OR stress_syllable >= 1),
    CONSTRAINT chk_vocab_part_of_speech CHECK (
        part_of_speech IN (
            'n.', 'v.', 'adj.', 'adv.', 'prep.', 'conj.', 'pron.', 'det.',
            'exclam.', 'number', 'modal v.', 'article', 'indefinite article.',
            'infinitive marker'
        )
    )
);

-- Bảng 6: vocabulary_embeddings (VectorDB pgvector 1:1 với vocabularies)
CREATE TABLE vocabulary_embeddings (
    vocabulary_id   INT          PRIMARY KEY
                                 REFERENCES vocabularies(id) ON DELETE CASCADE,
    embedding       vector(768)  NOT NULL,
    embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-004',
    content_hash    CHAR(64)     NOT NULL,
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Bảng 7: decks (Bài học lộ trình system_lesson + bộ thẻ cá nhân custom_deck nhặt từ kho Oxford)
CREATE TABLE decks (
    id                   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id              INT                  NULL REFERENCES users(id)  ON DELETE CASCADE,
    topic_id             INT                  NULL REFERENCES topics(id) ON DELETE RESTRICT,
    deck_type            deck_type_enum       NOT NULL DEFAULT 'custom_deck',
    order_index          INT                  NULL,
    name                 VARCHAR(150)         NOT NULL,
    description          TEXT                 NULL,
    is_public            BOOLEAN              NOT NULL DEFAULT TRUE,
    cefr_level           deck_cefr_level_enum NOT NULL DEFAULT 'all',
    total_cards          INT                  NOT NULL DEFAULT 0,
    pass_score_threshold DECIMAL(5,2)         NOT NULL DEFAULT 80.00,
    deleted_at           TIMESTAMPTZ          NULL,
    created_at           TIMESTAMPTZ          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMPTZ          NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_decks_kind CHECK (
        (deck_type = 'system_lesson' AND user_id IS NULL AND topic_id IS NOT NULL
         AND order_index IS NOT NULL AND cefr_level <> 'all' AND deleted_at IS NULL)
        OR (deck_type = 'custom_deck' AND user_id IS NOT NULL)
    ),
    CONSTRAINT chk_decks_order_index CHECK (order_index IS NULL OR order_index >= 1),
    CONSTRAINT chk_decks_total_cards CHECK (total_cards >= 0),
    CONSTRAINT chk_decks_threshold CHECK (pass_score_threshold BETWEEN 0.00 AND 100.00)
);

-- Lưu ý: Import Excel / DOCX / TXT xử lý đồng bộ hoặc qua BullMQ (Redis tạm),
-- đối chiếu với kho Oxford (vocabularies), trả preview rồi nạp vào decks + deck_vocabularies.

-- Bảng 8: deck_vocabularies (N:N giữa decks và vocabularies; DEFERRABLE để kéo thả đổi thứ tự)
CREATE TABLE deck_vocabularies (
    deck_id         INT         NOT NULL REFERENCES decks(id)        ON DELETE CASCADE,
    vocabulary_id   INT         NOT NULL REFERENCES vocabularies(id) ON DELETE CASCADE,
    order_in_lesson INT         NOT NULL DEFAULT 1,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (deck_id, vocabulary_id),
    CONSTRAINT chk_deck_vocab_order CHECK (order_in_lesson >= 1),
    CONSTRAINT uq_deck_vocab_order UNIQUE (deck_id, order_in_lesson) DEFERRABLE INITIALLY DEFERRED
);

-- ============================================================================
-- 6. PHÂN HỆ 3: TIẾN ĐỘ BÀI HỌC, SM-2 / LEITNER, PHIÊN HỌC & LOG (4 BẢNG)
-- ============================================================================

-- Bảng 9: user_lesson_progress (Luồng 2 bước Học nạp -> Học áp dụng & ngưỡng động)
CREATE TABLE user_lesson_progress (
    id                      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                 INT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id                 INT          NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
    acquisition_completed   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_completed            BOOLEAN      NOT NULL DEFAULT FALSE,
    best_score              DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    last_score              DECIMAL(5,2) NULL,
    attempts_count          INT          NOT NULL DEFAULT 0,
    pass_threshold_snapshot DECIMAL(5,2) NULL,
    first_completed_at      TIMESTAMPTZ  NULL,
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_lesson_progress UNIQUE (user_id, deck_id),
    CONSTRAINT chk_lesson_progress_score CHECK (
        best_score BETWEEN 0.00 AND 100.00
        AND (last_score IS NULL OR last_score BETWEEN 0.00 AND 100.00)
        AND (pass_threshold_snapshot IS NULL OR pass_threshold_snapshot BETWEEN 0.00 AND 100.00)
    ),
    CONSTRAINT chk_lesson_progress_attempts CHECK (attempts_count >= 0),
    CONSTRAINT chk_lesson_progress_completed CHECK (
        NOT is_completed OR (
            acquisition_completed
            AND first_completed_at IS NOT NULL
            AND pass_threshold_snapshot IS NOT NULL
            AND best_score >= pass_threshold_snapshot
        )
    )
);

-- Bảng 10: user_vocabulary_progress (SM-2 & Leitner cho từng cặp user - vocabulary)
CREATE TABLE user_vocabulary_progress (
    id               INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          INT                  NOT NULL REFERENCES users(id)        ON DELETE CASCADE,
    vocabulary_id    INT                  NOT NULL REFERENCES vocabularies(id) ON DELETE RESTRICT,
    leitner_box      SMALLINT             NOT NULL DEFAULT 1,
    repetitions      INT                  NOT NULL DEFAULT 0,
    ease_factor      DECIMAL(8,4)         NOT NULL DEFAULT 2.5000,
    interval_days    INT                  NOT NULL DEFAULT 0,
    last_reviewed_at TIMESTAMPTZ          NULL,
    next_review_date DATE                 NOT NULL,
    status           progress_status_enum NOT NULL DEFAULT 'new',
    correct_count    INT                  NOT NULL DEFAULT 0,
    incorrect_count  INT                  NOT NULL DEFAULT 0,
    total_reviews    INT GENERATED ALWAYS AS (correct_count + incorrect_count) STORED,
    created_at       TIMESTAMPTZ          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMPTZ          NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_progress_user_vocab UNIQUE (user_id, vocabulary_id),
    CONSTRAINT chk_progress_leitner_box CHECK (leitner_box BETWEEN 1 AND 5),
    CONSTRAINT chk_progress_repetitions CHECK (repetitions >= 0),
    CONSTRAINT chk_progress_ease_factor CHECK (ease_factor >= 1.3000),
    CONSTRAINT chk_progress_interval CHECK (interval_days >= 0),
    CONSTRAINT chk_progress_counts CHECK (correct_count >= 0 AND incorrect_count >= 0),
    CONSTRAINT chk_progress_mastered CHECK (
        status <> 'mastered' OR (leitner_box = 5 AND interval_days >= 21)
    )
);

-- Bảng 11: study_sessions (Phiên học nạp, áp dụng, ôn tập SM-2, kiểm tra tổng hợp)
CREATE TABLE study_sessions (
    id               INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id          INT               NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deck_id          INT               NULL     REFERENCES decks(id) ON DELETE SET NULL,
    session_type     session_type_enum NOT NULL DEFAULT 'lesson_practice',
    start_time       TIMESTAMPTZ       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time         TIMESTAMPTZ       NULL,
    total_questions  INT               NOT NULL DEFAULT 0,
    correct_answers  INT               NOT NULL DEFAULT 0,
    total_score      DECIMAL(6,2)      NOT NULL DEFAULT 0.00,
    score_percentage DECIMAL(5,2)      NOT NULL DEFAULT 0.00,
    xp_earned        INT               NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_session_counts CHECK (
        total_questions >= 0 AND correct_answers >= 0 AND correct_answers <= total_questions
    ),
    CONSTRAINT chk_session_score CHECK (total_score >= 0.00 AND total_score <= total_questions),
    CONSTRAINT chk_session_percentage CHECK (score_percentage BETWEEN 0.00 AND 100.00),
    CONSTRAINT chk_session_xp CHECK (xp_earned >= 0),
    CONSTRAINT chk_session_time CHECK (end_time IS NULL OR end_time >= start_time)
);

-- Bảng 12: review_logs (Lịch sử trả lời chi tiết + điểm 0.50 + question_payload JSONB)
CREATE TABLE review_logs (
    id                           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                      INT                 NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
    vocabulary_id                INT                 NOT NULL REFERENCES vocabularies(id)   ON DELETE RESTRICT,
    session_id                   INT                 NULL     REFERENCES study_sessions(id) ON DELETE SET NULL,
    practice_mode                practice_mode_enum  NOT NULL,
    user_answer                  TEXT                NULL,
    question_payload             JSONB               NULL,
    grading_status               grading_status_enum NOT NULL,
    score                        DECIMAL(3,2)        NOT NULL,
    is_correct                   BOOLEAN             NOT NULL,
    damerau_levenshtein_distance INT                 NULL,
    soundex_matched              BOOLEAN             NULL,
    quality_rating               SMALLINT            NOT NULL,
    response_time_ms             INT                 NOT NULL DEFAULT 0,
    created_at                   TIMESTAMPTZ         NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_review_quality CHECK (quality_rating BETWEEN 0 AND 5),
    CONSTRAINT chk_review_correctness CHECK (is_correct = (quality_rating >= 3)),
    CONSTRAINT chk_review_distance CHECK (
        damerau_levenshtein_distance IS NULL OR damerau_levenshtein_distance >= 0
    ),
    CONSTRAINT chk_review_grading_score CHECK (
        (grading_status = 'exact' AND score = 1.00)
        OR (grading_status = 'near_match' AND score = 0.50)
        OR (grading_status IN ('phonetic_match', 'incorrect') AND score = 0.00)
    ),
    CONSTRAINT chk_review_response_time CHECK (response_time_ms >= 0)
);

-- ============================================================================
-- 7. PHÂN HỆ 4: GAMIFICATION, THỐNG KÊ & NHẮC NHỞ TỰ ĐỘNG (5 BẢNG)
-- ============================================================================

-- Bảng 13: user_streaks (1:1 với users)
CREATE TABLE user_streaks (
    id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             INT         NOT NULL UNIQUE
                                    REFERENCES users(id) ON DELETE CASCADE,
    current_streak      INT         NOT NULL DEFAULT 0,
    longest_streak      INT         NOT NULL DEFAULT 0,
    last_study_date     DATE        NULL,
    freeze_streak_count INT         NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_streaks_non_neg CHECK (
        current_streak >= 0 AND longest_streak >= 0 AND freeze_streak_count >= 0
    ),
    CONSTRAINT chk_streaks_longest CHECK (longest_streak >= current_streak)
);

-- Bảng 14: daily_activities (Thống kê ngày kèm độ chính xác & thời gian học tuần)
CREATE TABLE daily_activities (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id               INT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_date         DATE        NOT NULL,
    words_learned         INT         NOT NULL DEFAULT 0,
    words_reviewed        INT         NOT NULL DEFAULT 0,
    questions_answered    INT         NOT NULL DEFAULT 0,
    correct_answers       INT         NOT NULL DEFAULT 0,
    study_seconds         INT         NOT NULL DEFAULT 0,
    total_xp              INT         NOT NULL DEFAULT 0,
    target_words_snapshot INT         NOT NULL,
    is_target_met         BOOLEAN     NOT NULL DEFAULT FALSE,
    timezone_used         VARCHAR(64) NOT NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_daily_activity UNIQUE (user_id, activity_date),
    CONSTRAINT chk_activity_counts CHECK (
        words_learned >= 0 AND words_reviewed >= 0
        AND questions_answered >= 0 AND correct_answers >= 0
        AND correct_answers <= questions_answered
        AND study_seconds >= 0 AND total_xp >= 0
    ),
    CONSTRAINT chk_activity_target_positive CHECK (target_words_snapshot > 0),
    CONSTRAINT chk_activity_target_met CHECK (
        is_target_met = (words_learned >= target_words_snapshot)
    )
);

-- Bảng 15: badges (Hỗ trợ icon_key thư viện UI + icon_url ảnh tùy chọn)
CREATE TABLE badges (
    id              INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            VARCHAR(50)               NOT NULL UNIQUE,
    name            VARCHAR(100)              NOT NULL,
    description     TEXT                      NOT NULL,
    icon_key        VARCHAR(100)              NOT NULL,
    icon_url        VARCHAR(500)              NULL,
    condition_type  badge_condition_type_enum NOT NULL,
    condition_value INT                       NOT NULL,
    is_active       BOOLEAN                   NOT NULL DEFAULT TRUE,

    CONSTRAINT chk_badge_condition_value CHECK (condition_value > 0)
);

-- Bảng 16: user_badges (N:N giữa users và badges)
CREATE TABLE user_badges (
    id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id   INT         NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
    badge_id  INT         NOT NULL REFERENCES badges(id) ON DELETE RESTRICT,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_user_badge UNIQUE (user_id, badge_id)
);

-- Bảng 17: reminder_settings (Nhắc hàng ngày + Cảnh báo Streak 20:00 + Lâu không học)
CREATE TABLE reminder_settings (
    id                             INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id                        INT         NOT NULL UNIQUE
                                               REFERENCES users(id) ON DELETE CASCADE,
    email_reminder_enabled         BOOLEAN     NOT NULL DEFAULT TRUE,
    reminder_time                  TIME        NOT NULL DEFAULT '20:00:00',
    is_warning_streak_enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
    is_inactivity_reminder_enabled BOOLEAN     NOT NULL DEFAULT TRUE,
    next_email_reminder_at_utc     TIMESTAMPTZ NULL,
    next_streak_warning_at_utc     TIMESTAMPTZ NULL,
    last_email_reminded_date       DATE        NULL,
    last_streak_warning_date       DATE        NULL,
    last_inactivity_reminded_at    TIMESTAMPTZ NULL,
    updated_at                     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Lưu ý: Hàng đợi gửi email, retry và log gửi thất bại do BullMQ (Redis) + logger ứng dụng xử lý.

-- ============================================================================
-- 8. PHÂN HỆ 5: HỘI THOẠI (TRỢ LÝ AI LEVEL 2 + HỖ TRỢ ADMIN) (2 BẢNG)
-- ============================================================================

-- Bảng 18: chat_conversations
CREATE TABLE chat_conversations (
    id                INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           INT              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type              chat_type_enum   NOT NULL DEFAULT 'ai_assistant',
    status            chat_status_enum NOT NULL DEFAULT 'open',
    assigned_admin_id INT              NULL     REFERENCES users(id) ON DELETE SET NULL,
    title             VARCHAR(200)     NOT NULL DEFAULT 'Cuộc trò chuyện mới',
    created_at        TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMPTZ      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_chat_admin_only CHECK (assigned_admin_id IS NULL OR type = 'admin_support')
);

-- Bảng 19: chat_messages (Hỗ trợ tool_calls JSONB cho AI Level 2 & read_at cho Admin Support)
CREATE TABLE chat_messages (
    id                    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id       INT                   NOT NULL
                                                REFERENCES chat_conversations(id) ON DELETE CASCADE,
    sender                chat_sender_enum      NOT NULL,
    sender_user_id        INT                   NULL
                                                REFERENCES users(id)              ON DELETE SET NULL,
    content               TEXT                  NOT NULL,
    related_vocabulary_id INT                   NULL
                                                REFERENCES vocabularies(id)       ON DELETE SET NULL,
    feedback_type         ai_feedback_type_enum NOT NULL DEFAULT 'general',
    tool_calls            JSONB                 NULL,
    tokens_used           INT                   NULL,
    read_at               TIMESTAMPTZ           NULL,
    created_at            TIMESTAMPTZ           NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_chat_tokens CHECK (tokens_used IS NULL OR tokens_used >= 0),
    CONSTRAINT chk_chat_sender_user CHECK (sender <> 'assistant' OR sender_user_id IS NULL)
);

-- ============================================================================
-- 9. CHỈ MỤC TỐI ƯU HÓA TRUY VẤN (INDEXING STRATEGY)
-- ============================================================================

-- 9.1. Xác thực & Dọn token hết hạn
CREATE INDEX idx_refresh_user_state_expiry
    ON refresh_tokens (user_id, is_revoked, expires_at);

CREATE INDEX idx_refresh_expiry
    ON refresh_tokens (expires_at);

-- 9.2. Từ điển, Semantic RAG (pgvector HNSW), Distractors & Stratified Sampling
CREATE INDEX idx_vocab_embeddings_hnsw
    ON vocabulary_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

CREATE INDEX idx_vocab_word_lower_prefix
    ON vocabularies (LOWER(word) text_pattern_ops)
    WHERE is_active = TRUE;

CREATE INDEX idx_vocab_meaning_trgm
    ON vocabularies
    USING gin (vietnamese_meaning gin_trgm_ops, word gin_trgm_ops);

CREATE INDEX idx_vocab_level_pos_active
    ON vocabularies (cefr_level, part_of_speech, word)
    WHERE is_active = TRUE;

CREATE INDEX idx_vocab_topic_level_active
    ON vocabularies (topic_id, cefr_level)
    WHERE is_active = TRUE;

CREATE INDEX idx_vocab_topic_id
    ON vocabularies (topic_id);

-- 9.3. Bài học lộ trình & Bộ thẻ cá nhân
CREATE UNIQUE INDEX uq_decks_system_lesson_order
    ON decks (topic_id, cefr_level, order_index)
    WHERE deck_type = 'system_lesson' AND deleted_at IS NULL;

CREATE INDEX idx_decks_type_public_level
    ON decks (deck_type, is_public, cefr_level)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_decks_user
    ON decks (user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_deck_vocab_vocabulary
    ON deck_vocabularies (vocabulary_id);

-- 9.4. Tiến độ bài học, SM-2 Partial Index, Phiên học & Log
CREATE INDEX idx_user_lesson_progress_user
    ON user_lesson_progress (user_id, is_completed);

CREATE INDEX idx_user_sm2_due
    ON user_vocabulary_progress (user_id, next_review_date)
    WHERE status IN ('learning', 'reviewing');

CREATE INDEX idx_study_sessions_user_start
    ON study_sessions (user_id, start_time DESC);

CREATE INDEX idx_review_logs_session
    ON review_logs (session_id);

CREATE INDEX idx_review_logs_user_mistakes
    ON review_logs (user_id, is_correct, created_at DESC);

CREATE INDEX idx_review_logs_user_vocab
    ON review_logs (user_id, vocabulary_id, created_at DESC);

-- 9.5. Gamification & Scheduler nhắc học
CREATE INDEX idx_leaderboard_streak
    ON user_streaks (current_streak DESC, longest_streak DESC);

CREATE INDEX idx_user_badges_user_earned
    ON user_badges (user_id, earned_at DESC);

CREATE INDEX idx_reminder_email_due
    ON reminder_settings (next_email_reminder_at_utc)
    WHERE email_reminder_enabled = TRUE;

CREATE INDEX idx_reminder_streak_due
    ON reminder_settings (next_streak_warning_at_utc)
    WHERE is_warning_streak_enabled = TRUE;

CREATE INDEX idx_reminder_inactivity_enabled
    ON reminder_settings (last_inactivity_reminded_at)
    WHERE is_inactivity_reminder_enabled = TRUE;

-- 9.6. Hội thoại AI & Hỗ trợ Admin
CREATE INDEX idx_chat_user_updated
    ON chat_conversations (user_id, updated_at DESC);

CREATE INDEX idx_chat_support_queue
    ON chat_conversations (status, updated_at DESC)
    WHERE type = 'admin_support';

CREATE INDEX idx_chat_messages_page
    ON chat_messages (conversation_id, created_at, id);

-- ============================================================================
-- 10. GẮN TRIGGER TỰ ĐỘNG CẬP NHẬT updated_at CHO TOÀN BỘ 10 BẢNG
-- ============================================================================
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_vocabularies_updated_at
    BEFORE UPDATE ON vocabularies FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_vocabulary_embeddings_updated_at
    BEFORE UPDATE ON vocabulary_embeddings FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_decks_updated_at
    BEFORE UPDATE ON decks FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_user_lesson_progress_updated_at
    BEFORE UPDATE ON user_lesson_progress FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_user_vocabulary_progress_updated_at
    BEFORE UPDATE ON user_vocabulary_progress FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_user_streaks_updated_at
    BEFORE UPDATE ON user_streaks FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_reminder_settings_updated_at
    BEFORE UPDATE ON reminder_settings FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER trg_chat_conversations_updated_at
    BEFORE UPDATE ON chat_conversations FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

COMMIT;
