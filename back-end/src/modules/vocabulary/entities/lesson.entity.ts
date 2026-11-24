import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Topic } from './topic.entity';
import { CefrLevel } from './vocabulary.entity';
import { LessonVocabulary } from './lesson-vocabulary.entity';

@Entity('lessons')
@Index('idx_lesson_level_topic', ['cefrLevel', 'topicId'])
export class Lesson {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'topic_id', type: 'int' })
  topicId: number;

  @Column({
    name: 'cefr_level',
    type: 'enum',
    enum: CefrLevel,
    enumName: 'cefr_level_enum',
  })
  cefrLevel: CefrLevel;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ name: 'order_index', type: 'int' })
  orderIndex: number;

  @Column({ name: 'word_count', type: 'int' })
  wordCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Topic, (topic) => topic.lessons, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'topic_id' })
  topic: Topic;

  @OneToMany(() => LessonVocabulary, (lv) => lv.lesson)
  lessonVocabularies: LessonVocabulary[];
}
