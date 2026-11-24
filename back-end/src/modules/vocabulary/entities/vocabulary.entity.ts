import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { Topic } from './topic.entity';
import { LessonVocabulary } from './lesson-vocabulary.entity';

export enum CefrLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
}

export const VALID_PARTS_OF_SPEECH = [
  'n.',
  'v.',
  'adj.',
  'adv.',
  'prep.',
  'conj.',
  'pron.',
  'det.',
  'modal v.',
  'number',
  'exclam.',
  'article',
  'article.',
  'indefinite article.',
  'infinitive marker',
] as const;

@Entity('vocabularies')
@Unique('unique_word_level_pos_sense', ['word', 'cefrLevel', 'partOfSpeech', 'senseNumber'])
@Index('idx_vocab_distractor', ['cefrLevel', 'partOfSpeech', 'topicId'])
export class Vocabulary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  word: string;

  @Column({
    name: 'cefr_level',
    type: 'enum',
    enum: CefrLevel,
    enumName: 'cefr_level_enum',
  })
  cefrLevel: CefrLevel;

  @Column({ name: 'part_of_speech', type: 'varchar', length: 30 })
  partOfSpeech: string;

  @Column({ name: 'sense_number', type: 'smallint', default: 1 })
  senseNumber: number;

  @Column({ type: 'varchar', length: 100 })
  phonetic: string;

  @Column({ name: 'vietnamese_meaning', type: 'varchar', length: 255 })
  vietnameseMeaning: string;

  @Column({ name: 'example_en', type: 'text' })
  exampleEn: string;

  @Column({ name: 'example_vi', type: 'text' })
  exampleVi: string;

  @Column({ name: 'topic_id', type: 'int' })
  topicId: number;

  @Column({ name: 'audio_url', type: 'varchar', length: 500, nullable: true })
  audioUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Topic, (topic) => topic.vocabularies, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'topic_id' })
  topic: Topic;

  @OneToMany(() => LessonVocabulary, (lv) => lv.vocabulary)
  lessonVocabularies: LessonVocabulary[];
}
