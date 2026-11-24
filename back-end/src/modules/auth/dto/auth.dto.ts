import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export class RegisterDto {
  @ApiProperty({ example: 'sv01@vnua.edu.vn', maxLength: 255 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email phải là địa chỉ email hợp lệ' })
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'Password123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu tối đa 72 ký tự' })
  @Matches(PASSWORD_REGEX, {
    message: 'Mật khẩu phải chứa ít nhất 1 chữ cái và 1 chữ số',
  })
  password: string;

  @ApiProperty({ example: 'Nguyễn Văn A', minLength: 1, maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  fullName: string;
}

export class LoginDto {
  @ApiProperty({ example: 'sv01@vnua.edu.vn', maxLength: 255 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email phải là địa chỉ email hợp lệ' })
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'Password123', minLength: 1, maxLength: 72 })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password: string;
}

export class GoogleLoginDto {
  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6...' })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export class RefreshDto {
  @ApiProperty({ example: 'a1b2c3d4e5f6...' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class LogoutDto {
  @ApiProperty({ example: 'a1b2c3d4e5f6...' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'Password123', minLength: 1, maxLength: 72 })
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword123', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  @MaxLength(72, { message: 'Mật khẩu mới tối đa 72 ký tự' })
  @Matches(PASSWORD_REGEX, {
    message: 'Mật khẩu mới phải chứa ít nhất 1 chữ cái và 1 chữ số',
  })
  newPassword: string;
}
