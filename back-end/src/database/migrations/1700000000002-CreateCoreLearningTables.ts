import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCoreLearningTables1700000000002 implements MigrationInterface {
  name = 'CreateCoreLearningTables1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
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
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
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
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_sessions (
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
          CONSTRAINT chk_refresh_expiry CHECK (expires_at > created_at),
          CONSTRAINT chk_refresh_revoked_at CHECK (
              (NOT is_revoked AND revoked_at IS NULL) OR (is_revoked AND revoked_at IS NOT NULL)
          ),
          CONSTRAINT chk_refresh_not_self_replaced CHECK (
              replaced_by_hash IS NULL OR replaced_by_hash <> token_hash
          )
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_refresh_user_family ON refresh_sessions (user_id, session_family_id);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_refresh_expires_at ON refresh_sessions (expires_at);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_lesson_progress (
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
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS quiz_attempts (
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
          submitted_at TIMESTAMPTZ NULL,
          CONSTRAINT uq_quiz_attempts_id_user UNIQUE (id, user_id),
          CONSTRAINT chk_quiz_attempt_type_lesson CHECK (
              (attempt_type = 'lesson_practice' AND lesson_id IS NOT NULL)
              OR (attempt_type IN ('sm2_review', 'mixed_quiz') AND lesson_id IS NULL)
          ),
          CONSTRAINT chk_quiz_attempt_status_time CHECK (
              (status = 'in_progress' AND submitted_at IS NULL)
              OR (status = 'submitted' AND submitted_at IS NOT NULL AND submitted_at >= started_at)
          )
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_lesson ON quiz_attempts (user_id, lesson_id, status);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
          id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          attempt_id INT NOT NULL,
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
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT fk_answer_attempt_owner FOREIGN KEY (attempt_id, user_id) REFERENCES quiz_attempts(id, user_id) ON DELETE CASCADE,
          CONSTRAINT uq_attempt_answer_vocab UNIQUE (attempt_id, vocabulary_id),
          CONSTRAINT chk_answer_grading_consistency CHECK (
              (grading_status = 'exact' AND score = 1.00 AND quality_rating IN (3, 4, 5))
              OR (grading_status = 'near_match' AND score = 0.50 AND quality_rating = 3)
              OR (grading_status = 'phonetic_match' AND score = 0.00 AND quality_rating = 2)
              OR (grading_status = 'incorrect' AND score = 0.00 AND quality_rating IN (0, 1))
          )
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_attempt_answers_user_vocab ON quiz_attempt_answers (user_id, vocabulary_id, created_at DESC);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_sm2_reviews (
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
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_sm2_due ON user_sm2_reviews (user_id, next_review_date, leitner_box, id);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_streaks (
          id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          current_streak INT NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
          longest_streak INT NOT NULL DEFAULT 0 CHECK (longest_streak >= current_streak),
          last_study_date DATE NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT chk_streak_last_study_date CHECK (current_streak = 0 OR last_study_date IS NOT NULL)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_streaks_reminder_scan ON user_streaks (current_streak, last_study_date) WHERE current_streak >= 1;`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS daily_study_logs (
          id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          study_date DATE NOT NULL,
          words_learned INT NOT NULL DEFAULT 0 CHECK (words_learned >= 0),
          words_reviewed INT NOT NULL DEFAULT 0 CHECK (words_reviewed >= 0),
          lesson_practices_completed INT NOT NULL DEFAULT 0 CHECK (lesson_practices_completed >= 0),
          sm2_sessions_completed INT NOT NULL DEFAULT 0 CHECK (sm2_sessions_completed >= 0),
          streak_qualified BOOLEAN NOT NULL DEFAULT FALSE,
          reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
          reminder_status VARCHAR(20) NULL CHECK (reminder_status IS NULL OR reminder_status IN ('queued', 'delivered', 'failed')),
          reminder_attempts SMALLINT NOT NULL DEFAULT 0 CHECK (reminder_attempts >= 0),
          reminder_sent_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_daily_study_log UNIQUE (user_id, study_date)
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
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
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_audit_actor_created ON audit_logs (actor_user_id, created_at DESC);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS daily_study_logs;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_streaks;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_sm2_reviews;`);
    await queryRunner.query(`DROP TABLE IF EXISTS quiz_attempt_answers;`);
    await queryRunner.query(`DROP TABLE IF EXISTS quiz_attempts;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_lesson_progress;`);
    await queryRunner.query(`DROP TABLE IF EXISTS refresh_sessions;`);
    await queryRunner.query(`DROP TABLE IF EXISTS users;`);

    await queryRunner.query(`DROP TYPE IF EXISTS grading_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS practice_mode_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS quiz_attempt_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS quiz_attempt_type_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS auth_provider_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role_enum;`);
  }
}
