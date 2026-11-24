import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchVocabDto {
  @ApiProperty({ example: 'abandon', minLength: 1, maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'q must be a string' })
  @IsNotEmpty({ message: 'q should not be empty' })
  @MinLength(1, { message: 'q must be longer than or equal to 1 characters' })
  @MaxLength(100, { message: 'q must be shorter than or equal to 100 characters' })
  q: string;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer number' })
  @Min(1, { message: 'limit must not be less than 1' })
  @Max(50, { message: 'limit must not be greater than 50' })
  limit?: number = 20;
}
