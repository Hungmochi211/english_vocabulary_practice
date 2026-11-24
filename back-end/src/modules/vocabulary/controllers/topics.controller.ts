import { Controller, Get } from '@nestjs/common';
import { LessonService } from '../services/lesson.service';

@Controller('topics')
export class TopicsController {
  constructor(private readonly lessonService: LessonService) {}

  @Get()
  async getAllTopics() {
    return this.lessonService.findAllTopicsWithLessonCount();
  }
}
