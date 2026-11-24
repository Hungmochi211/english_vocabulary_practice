import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVocabularyCoreTables1700000000001 implements MigrationInterface {
  name = 'CreateVocabularyCoreTables1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    await queryRunner.query(`
      DO $$ BEGIN
          CREATE TYPE cefr_level_enum AS ENUM ('A1', 'A2', 'B1', 'B2');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS topics (
          id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          code VARCHAR(50) NOT NULL UNIQUE,
          name VARCHAR(100) NOT NULL,
          name_vi VARCHAR(100) NOT NULL,
          description TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS vocabularies (
          id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          word VARCHAR(100) NOT NULL,
          cefr_level cefr_level_enum NOT NULL,
          part_of_speech VARCHAR(30) NOT NULL,
          sense_number SMALLINT NOT NULL DEFAULT 1 CHECK (sense_number >= 1),
          phonetic VARCHAR(100) NOT NULL,
          vietnamese_meaning VARCHAR(255) NOT NULL,
          example_en TEXT NOT NULL,
          example_vi TEXT NOT NULL,
          topic_id INT NOT NULL REFERENCES topics(id) ON DELETE RESTRICT,
          audio_url VARCHAR(500) NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT unique_word_level_pos_sense UNIQUE (word, cefr_level, part_of_speech, sense_number)
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_vocab_word_lower ON vocabularies (LOWER(word) text_pattern_ops);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_vocab_distractor ON vocabularies (cefr_level, part_of_speech, topic_id);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lessons (
          id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          topic_id INT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
          cefr_level cefr_level_enum NOT NULL,
          title VARCHAR(150) NOT NULL,
          order_index INT NOT NULL CHECK (order_index >= 1),
          word_count INT NOT NULL DEFAULT 0 CHECK (word_count >= 15 AND word_count <= 20),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_lesson_level_topic ON lessons (cefr_level, topic_id);
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lesson_vocabularies (
          id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          lesson_id INT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
          vocabulary_id INT NOT NULL REFERENCES vocabularies(id) ON DELETE CASCADE,
          order_in_lesson INT NOT NULL CHECK (order_in_lesson >= 1 AND order_in_lesson <= 20),
          CONSTRAINT unique_lesson_word UNIQUE (lesson_id, vocabulary_id),
          CONSTRAINT unique_lesson_order UNIQUE (lesson_id, order_in_lesson)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS lesson_vocabularies;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_lesson_level_topic;`);
    await queryRunner.query(`DROP TABLE IF EXISTS lessons;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_vocab_distractor;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_vocab_word_lower;`);
    await queryRunner.query(`DROP TABLE IF EXISTS vocabularies;`);
    await queryRunner.query(`DROP TABLE IF EXISTS topics;`);
    await queryRunner.query(`DROP TYPE IF EXISTS cefr_level_enum;`);
  }
}
