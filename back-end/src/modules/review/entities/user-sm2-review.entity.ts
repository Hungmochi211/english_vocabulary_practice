import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('user_sm2_reviews')
@Unique('uq_sm2_user_vocab', ['userId', 'vocabularyId'])
export class UserSm2Review {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'vocabulary_id', type: 'int' })
  vocabularyId: number;

  @Column({ name: 'easiness_factor', type: 'decimal', precision: 4, scale: 2, default: '2.50' })
  easinessFactor: string;

  @Column({ type: 'int', default: 0 })
  repetitions: number;

  @Column({ name: 'interval_days', type: 'int', default: 0 })
  intervalDays: number;

  @Column({ name: 'next_review_date', type: 'date' })
  nextReviewDate: string;

  @Column({ name: 'leitner_box', type: 'smallint', default: 1 })
  leitnerBox: number;

  @Column({ name: 'last_quality_rating', type: 'smallint', nullable: true })
  lastQualityRating: number | null;

  @Column({ name: 'last_reviewed_at', type: 'timestamptz', nullable: true })
  lastReviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
