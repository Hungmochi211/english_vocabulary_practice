import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Topic } from '../modules/vocabulary/entities/topic.entity';
import { Vocabulary } from '../modules/vocabulary/entities/vocabulary.entity';
import { Lesson } from '../modules/vocabulary/entities/lesson.entity';
import { LessonVocabulary } from '../modules/vocabulary/entities/lesson-vocabulary.entity';
import { CreateVocabularyCoreTables1700000000001 } from '../database/migrations/1700000000001-CreateVocabularyCoreTables';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'english_vocab_db',
  entities: [Topic, Vocabulary, Lesson, LessonVocabulary],
  migrations: [CreateVocabularyCoreTables1700000000001],
  synchronize: false,
  logging: false,
  extra: {
    max: 10,
    options: '-c timezone=Asia/Ho_Chi_Minh',
  },
};

export const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
