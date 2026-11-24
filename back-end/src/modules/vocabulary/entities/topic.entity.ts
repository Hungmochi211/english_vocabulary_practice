import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Lesson } from './lesson.entity';
import { Vocabulary } from './vocabulary.entity';

@Entity('topics')
export class Topic {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'name_vi', type: 'varchar', length: 100 })
  nameVi: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => Lesson, (lesson) => lesson.topic)
  lessons: Lesson[];

  @OneToMany(() => Vocabulary, (vocab) => vocab.topic)
  vocabularies: Vocabulary[];
}
