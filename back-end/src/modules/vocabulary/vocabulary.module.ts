import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Topic } from './entities/topic.entity';
import { Vocabulary } from './entities/vocabulary.entity';
import { Lesson } from './entities/lesson.entity';
import { LessonVocabulary } from './entities/lesson-vocabulary.entity';
import { LessonService } from './services/lesson.service';
import { VocabularyService } from './services/vocabulary.service';
import { TopicsController } from './controllers/topics.controller';
import { LessonsController } from './controllers/lessons.controller';
import { VocabulariesController } from './controllers/vocabularies.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Topic, Vocabulary, Lesson, LessonVocabulary]),
  ],
  controllers: [TopicsController, LessonsController, VocabulariesController],
  providers: [LessonService, VocabularyService],
  exports: [LessonService, VocabularyService],
})
export class VocabularyModule {}
