import {
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QuizAnswerInputDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  vocabularyId: number;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(100)
  userAnswer?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(300000)
  responseTimeMs: number;
}

export class SubmitQuizDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerInputDto)
  answers: QuizAnswerInputDto[];
}
