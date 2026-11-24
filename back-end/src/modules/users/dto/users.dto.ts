import {
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsUrl,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CefrLevel } from '../../vocabulary/entities/vocabulary.entity';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Nguyễn Văn A', minLength: 1, maxLength: 100 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/avatar.png', maxLength: 500, nullable: true })
  @IsOptional()
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString()
  @MaxLength(500)
  @IsUrl({ require_protocol: true }, { message: 'avatarUrl phải là URL hợp lệ' })
  avatarUrl?: string | null;

  @ApiPropertyOptional({ enum: CefrLevel, example: CefrLevel.B1 })
  @IsOptional()
  @IsEnum(CefrLevel)
  targetLevel?: CefrLevel;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  emailReminderEnabled?: boolean;
}

export class AdminPaginationQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class AdminUpdateStatusDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isActive: boolean;
}
