import 'reflect-metadata';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Topic } from '../modules/vocabulary/entities/topic.entity';
import { Vocabulary } from '../modules/vocabulary/entities/vocabulary.entity';
import { Lesson } from '../modules/vocabulary/entities/lesson.entity';
import { LessonVocabulary } from '../modules/vocabulary/entities/lesson-vocabulary.entity';
import { AuditLog } from '../modules/audit/entities/audit-log.entity';
import { User } from '../modules/users/entities/user.entity';
import { RefreshSession } from '../modules/users/entities/refresh-session.entity';
import { UserLessonProgress } from '../modules/learning/entities/user-lesson-progress.entity';
import { QuizAttempt } from '../modules/learning/entities/quiz-attempt.entity';
import { QuizAttemptAnswer } from '../modules/learning/entities/quiz-attempt-answer.entity';
import { UserSm2Review } from '../modules/review/entities/user-sm2-review.entity';
import { UserStreak } from '../modules/gamification/entities/user-streak.entity';
import { DailyStudyLog } from '../modules/gamification/entities/daily-study-log.entity';
import { CreateVocabularyCoreTables1700000000001 } from '../database/migrations/1700000000001-CreateVocabularyCoreTables';
import { CreateCoreLearningTables1700000000002 } from '../database/migrations/1700000000002-CreateCoreLearningTables';
import { CreateUserSyncAndSupportTables1700000000003 } from '../database/migrations/1700000000003-CreateUserSyncAndSupportTables';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5433),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'english_vocab_db',
  entities: [
    Topic,
    Vocabulary,
    Lesson,
    LessonVocabulary,
    AuditLog,
    User,
    RefreshSession,
    UserLessonProgress,
    QuizAttempt,
    QuizAttemptAnswer,
    UserSm2Review,
    UserStreak,
    DailyStudyLog,
  ],
  migrations: [
    CreateVocabularyCoreTables1700000000001,
    CreateCoreLearningTables1700000000002,
    CreateUserSyncAndSupportTables1700000000003,
  ],
  synchronize: false,
  logging: false,
  extra: {
    max: 10,
    options: '-c timezone=Asia/Ho_Chi_Minh',
  },
};

export const AppDataSource = new DataSource(dataSourceOptions);
export default AppDataSource;
