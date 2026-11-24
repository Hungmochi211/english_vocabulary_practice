import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('daily_study_logs')
@Unique('uq_daily_study_log', ['userId', 'studyDate'])
export class DailyStudyLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'study_date', type: 'date' })
  studyDate: string;

  @Column({ name: 'words_learned', type: 'int', default: 0 })
  wordsLearned: number;

  @Column({ name: 'words_reviewed', type: 'int', default: 0 })
  wordsReviewed: number;

  @Column({ name: 'lesson_practices_completed', type: 'int', default: 0 })
  lessonPracticesCompleted: number;

  @Column({ name: 'sm2_sessions_completed', type: 'int', default: 0 })
  sm2SessionsCompleted: number;

  @Column({ name: 'streak_qualified', type: 'boolean', default: false })
  streakQualified: boolean;

  @Column({ name: 'reminder_sent', type: 'boolean', default: false })
  reminderSent: boolean;

  @Column({ name: 'reminder_status', type: 'varchar', length: 20, nullable: true })
  reminderStatus: 'queued' | 'delivered' | 'failed' | null;

  @Column({ name: 'reminder_attempts', type: 'smallint', default: 0 })
  reminderAttempts: number;

  @Column({ name: 'reminder_sent_at', type: 'timestamptz', nullable: true })
  reminderSentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
