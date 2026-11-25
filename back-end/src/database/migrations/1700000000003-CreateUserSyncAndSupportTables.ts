import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserSyncAndSupportTables1700000000003 implements MigrationInterface {
  name = 'CreateUserSyncAndSupportTables1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
          CREATE TYPE notification_tone_enum AS ENUM ('amber', 'green', 'blue', 'purple');
          CREATE TYPE support_sender_role_enum AS ENUM ('learner', 'admin');
          CREATE TYPE support_ticket_status_enum AS ENUM ('open', 'resolved');
      EXCEPTION
          WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_saved_words (
          id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          vocabulary_id INT NOT NULL REFERENCES vocabularies(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_user_saved_word UNIQUE (user_id, vocabulary_id)
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_saved_words_user_created ON user_saved_words (user_id, created_at DESC);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
          id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(150) NOT NULL,
          body VARCHAR(500) NOT NULL,
          icon VARCHAR(40) NOT NULL DEFAULT 'bell',
          tone notification_tone_enum NOT NULL DEFAULT 'blue',
          target_route VARCHAR(200) NOT NULL DEFAULT '/',
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON user_notifications (user_id, created_at DESC, id DESC);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS support_messages (
          id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          sender_role support_sender_role_enum NOT NULL,
          sender_user_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
          content VARCHAR(1000) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_support_messages_user_created ON support_messages (user_id, created_at ASC, id ASC);`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS support_tickets (
          id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          ticket_code VARCHAR(20) NOT NULL UNIQUE,
          user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          category VARCHAR(80) NOT NULL,
          contact_email VARCHAR(255) NOT NULL,
          detail VARCHAR(2000) NOT NULL,
          status support_ticket_status_enum NOT NULL DEFAULT 'open',
          admin_reply VARCHAR(2000) NULL,
          replied_by_user_id INT NULL REFERENCES users(id) ON DELETE SET NULL,
          replied_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_support_tickets_status_created ON support_tickets (status ASC, created_at DESC);`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_support_tickets_user_created ON support_tickets (user_id, created_at DESC);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS support_tickets;`);
    await queryRunner.query(`DROP TABLE IF EXISTS support_messages;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_notifications;`);
    await queryRunner.query(`DROP TABLE IF EXISTS user_saved_words;`);
    await queryRunner.query(`DROP TYPE IF EXISTS support_ticket_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS support_sender_role_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS notification_tone_enum;`);
  }
}
