import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { GradingStatus, PracticeMode } from '../../algorithm/damerau-levenshtein.util';

@Entity('quiz_attempt_answers')
export class QuizAttemptAnswer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'attempt_id', type: 'int' })
  attemptId: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'vocabulary_id', type: 'int' })
  vocabularyId: number;

  @Column({
    name: 'practice_mode',
    type: 'enum',
    enum: ['multiple_choice', 'typing', 'dictation'],
    enumName: 'practice_mode_enum',
  })
  practiceMode: PracticeMode;

  @Column({ name: 'user_answer', type: 'text', nullable: true })
  userAnswer: string | null;

  @Column({
    name: 'grading_status',
    type: 'enum',
    enum: ['exact', 'near_match', 'phonetic_match', 'incorrect'],
    enumName: 'grading_status_enum',
  })
  gradingStatus: GradingStatus;

  @Column({ type: 'decimal', precision: 3, scale: 2 })
  score: string;

  @Column({ name: 'damerau_distance', type: 'int', nullable: true })
  damerauDistance: number | null;

  @Column({ name: 'soundex_matched', type: 'boolean', nullable: true })
  soundexMatched: boolean | null;

  @Column({ name: 'quality_rating', type: 'smallint' })
  qualityRating: number;

  @Column({ name: 'response_time_ms', type: 'int' })
  responseTimeMs: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
