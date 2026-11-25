import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  icon?: string;

  @IsOptional()
  @IsIn(['amber', 'green', 'blue', 'purple'])
  tone?: 'amber' | 'green' | 'blue' | 'purple';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(/^\/.*$/, { message: 'targetRoute phải là đường dẫn nội bộ bắt đầu bằng /' })
  targetRoute?: string;
}
