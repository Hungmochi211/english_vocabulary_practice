import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LearningService } from './learning.service';
import { QuizGradingService } from './quiz-grading.service';
import { LessonsQueryDto, MixedQuizStartDto } from './dto/learning.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';

@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(
    private readonly learningService: LearningService,
    private readonly quizGradingService: QuizGradingService,
  ) {}

  @Get('lessons')
  async getLessons(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LessonsQueryDto,
  ) {
    return this.learningService.getLessonsWithProgress(user.id, query);
  }

  @Post('lessons/:lessonId/cards/:vocabularyId/open')
  @HttpCode(HttpStatus.OK)
  async openCard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', ParseIntPipe) lessonId: number,
    @Param('vocabularyId', ParseIntPipe) vocabularyId: number,
  ) {
    return this.learningService.openCard(user.id, lessonId, vocabularyId);
  }

  @Post('lessons/:lessonId/practice/start')
  @HttpCode(HttpStatus.CREATED)
  async startLessonPractice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('lessonId', ParseIntPipe) lessonId: number,
  ) {
    return this.learningService.startLessonPractice(user.id, lessonId);
  }

  @Post('quizzes/mixed/start')
  @HttpCode(HttpStatus.CREATED)
  async startMixedQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto?: MixedQuizStartDto,
  ) {
    return this.learningService.startMixedQuiz(user.id, dto?.totalQuestions ?? 20);
  }

  @Post('quizzes/:attemptId/submit')
  @HttpCode(HttpStatus.OK)
  async submitQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attemptId', ParseIntPipe) attemptId: number,
    @Body() dto: SubmitQuizDto,
  ) {
    return this.quizGradingService.submitQuiz(user.id, attemptId, dto);
  }
}
