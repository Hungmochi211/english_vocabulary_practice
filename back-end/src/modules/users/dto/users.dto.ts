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
import { CefrLevel } from '../../vocabulary/entities/vocabulary.entity';

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @ValidateIf((_obj, val) => val !== null && val !== undefined)
  @IsString()
  @MaxLength(500)
  @IsUrl({ require_protocol: true }, { message: 'avatarUrl phải là URL hợp lệ' })
  avatarUrl?: string | null;

  @IsOptional()
  @IsEnum(CefrLevel)
  targetLevel?: CefrLevel;

  @IsOptional()
  @IsBoolean()
  emailReminderEnabled?: boolean;
}

export class AdminPaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class AdminUpdateStatusDto {
  @IsBoolean()
  isActive: boolean;
}
