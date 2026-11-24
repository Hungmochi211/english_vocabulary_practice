import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { LessonService } from '../services/lesson.service';
import { QueryLessonsDto } from '../dto/query-lessons.dto';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonService: LessonService) {}

  @Get()
  async getLessons(@Query() query: QueryLessonsDto) {
    return this.lessonService.findLessons(query);
  }

  @Get(':id')
  async getLessonById(@Param('id', ParseIntPipe) id: number) {
    return this.lessonService.findLessonDetailById(id);
  }
}
