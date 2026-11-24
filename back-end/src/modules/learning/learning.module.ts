import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserLessonProgress } from './entities/user-lesson-progress.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { QuizAttemptAnswer } from './entities/quiz-attempt-answer.entity';
import { LearningService } from './learning.service';
import { QuizGradingService } from './quiz-grading.service';
import { LearningController } from './learning.controller';
import { AlgorithmModule } from '../algorithm/algorithm.module';
import { ReviewModule } from '../review/review.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserLessonProgress, QuizAttempt, QuizAttemptAnswer]),
    AlgorithmModule,
    ReviewModule,
  ],
  controllers: [LearningController],
  providers: [LearningService, QuizGradingService],
  exports: [LearningService, QuizGradingService],
})
export class LearningModule {}
