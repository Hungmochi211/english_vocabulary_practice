import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LessonService } from '../services/lesson.service';

@ApiTags('Topics (001)')
@Controller('topics')
export class TopicsController {
  constructor(private readonly lessonService: LessonService) {}

  @Get()
  async getAllTopics() {
    return this.lessonService.findAllTopicsWithLessonCount();
  }
}
