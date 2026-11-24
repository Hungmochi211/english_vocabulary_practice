import { IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { CefrLevel } from '../../vocabulary/entities/vocabulary.entity';

export class LessonsQueryDto {
  @IsOptional()
  @IsEnum(CefrLevel)
  level?: CefrLevel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  topicId?: number;
}

export class MixedQuizStartDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(40)
  totalQuestions?: number = 20;
}
