import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { RefreshSession } from '../users/entities/refresh-session.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RateLimiterService } from './rate-limiter.service';
import { PasswordResetMailService } from './password-reset-mail.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { getAuthConfig } from '../../config/auth.config';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: () => {
        const cfg = getAuthConfig();
        return {
          secret: cfg.jwtAccessSecret,
          signOptions: { expiresIn: cfg.jwtAccessExpiresIn },
        };
      },
    }),
    TypeOrmModule.forFeature([User, RefreshSession]),
  ],
  controllers: [AuthController],
  providers: [AuthService, RateLimiterService, PasswordResetMailService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
