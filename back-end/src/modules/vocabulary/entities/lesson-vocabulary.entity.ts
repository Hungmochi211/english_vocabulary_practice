import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Lesson } from './lesson.entity';
import { Vocabulary } from './vocabulary.entity';

@Entity('lesson_vocabularies')
@Unique('unique_lesson_word', ['lessonId', 'vocabularyId'])
@Unique('unique_lesson_order', ['lessonId', 'orderInLesson'])
export class LessonVocabulary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'lesson_id', type: 'int' })
  lessonId: number;

  @Column({ name: 'vocabulary_id', type: 'int' })
  vocabularyId: number;

  @Column({ name: 'order_in_lesson', type: 'int' })
  orderInLesson: number;

  @ManyToOne(() => Lesson, (lesson) => lesson.lessonVocabularies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'lesson_id' })
  lesson: Lesson;

  @ManyToOne(() => Vocabulary, (vocab) => vocab.lessonVocabularies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'vocabulary_id' })
  vocabulary: Vocabulary;
}
