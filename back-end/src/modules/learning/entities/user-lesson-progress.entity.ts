import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('user_lesson_progress')
@Unique('uq_user_lesson_progress', ['userId', 'lessonId'])
export class UserLessonProgress {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'lesson_id', type: 'int' })
  lessonId: number;

  @Column({ name: 'opened_vocabulary_ids', type: 'int', array: true, default: () => "'{}'" })
  openedVocabularyIds: number[];

  @Column({ name: 'acquisition_completed', type: 'boolean', default: false })
  acquisitionCompleted: boolean;

  @Column({ name: 'is_completed', type: 'boolean', default: false })
  isCompleted: boolean;

  @Column({ name: 'best_score', type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  bestScore: string;

  @Column({ name: 'attempts_count', type: 'int', default: 0 })
  attemptsCount: number;

  @Column({ name: 'first_completed_at', type: 'timestamptz', nullable: true })
  firstCompletedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
