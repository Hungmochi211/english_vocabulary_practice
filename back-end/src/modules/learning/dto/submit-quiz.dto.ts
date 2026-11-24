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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuizAnswerInputDto {
  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  vocabularyId: number;

  @ApiPropertyOptional({ example: 'abandon', maxLength: 100, nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(100)
  userAnswer?: string | null;

  @ApiProperty({ example: 4200, minimum: 0, maximum: 300000 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(300000)
  responseTimeMs: number;
}

export class SubmitQuizDto {
  @ApiProperty({ type: [QuizAnswerInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerInputDto)
  answers: QuizAnswerInputDto[];
}
