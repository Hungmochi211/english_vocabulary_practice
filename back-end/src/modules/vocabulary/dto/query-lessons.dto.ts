import { IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CefrLevel } from '../entities/vocabulary.entity';

export class QueryLessonsDto {
  @ApiPropertyOptional({ enum: CefrLevel, example: CefrLevel.A1 })
  @IsOptional()
  @IsEnum(CefrLevel, {
    message: 'level must be one of the following values: A1, A2, B1, B2',
  })
  level?: CefrLevel;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'topicId must be an integer number' })
  @Min(1, { message: 'topicId must not be less than 1' })
  topicId?: number;
}
