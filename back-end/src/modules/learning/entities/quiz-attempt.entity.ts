import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { GeneratedQuestionSnapshot } from '../../algorithm/distractor.service';

export type QuizAttemptType = 'lesson_practice' | 'sm2_review' | 'mixed_quiz';
export type QuizAttemptStatus = 'in_progress' | 'submitted';

@Entity('quiz_attempts')
export class QuizAttempt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'lesson_id', type: 'int', nullable: true })
  lessonId: number | null;

  @Column({
    name: 'attempt_type',
    type: 'enum',
    enum: ['lesson_practice', 'sm2_review', 'mixed_quiz'],
    enumName: 'quiz_attempt_type_enum',
  })
  attemptType: QuizAttemptType;

  @Column({
    type: 'enum',
    enum: ['in_progress', 'submitted'],
    enumName: 'quiz_attempt_status_enum',
    default: 'in_progress',
  })
  status: QuizAttemptStatus;

  @Column({ name: 'questions_snapshot', type: 'jsonb' })
  questionsSnapshot: GeneratedQuestionSnapshot[];

  @Column({ name: 'due_count_snapshot', type: 'int', nullable: true })
  dueCountSnapshot: number | null;

  @Column({ name: 'total_questions', type: 'int' })
  totalQuestions: number;

  @Column({ name: 'total_score', type: 'decimal', precision: 6, scale: 2, default: '0.00' })
  totalScore: string;

  @Column({ name: 'score_percentage', type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  scorePercentage: string;

  @CreateDateColumn({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;
}
