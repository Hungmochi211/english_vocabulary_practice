import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CefrLevel } from '../entities/vocabulary.entity';

export class QueryLessonsDto {
  @IsOptional()
  @IsEnum(CefrLevel, {
    message: 'level must be one of the following values: A1, A2, B1, B2',
  })
  level?: CefrLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'topicId must be an integer number' })
  @Min(1, { message: 'topicId must not be less than 1' })
  topicId?: number;
}
