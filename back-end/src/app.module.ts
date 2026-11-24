import { Module, INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { dataSourceOptions } from './config/database.config';
import { getRedisConnectionOptions } from './config/redis.config';
import { RedisModule } from './config/redis.module';
import { AuditModule } from './modules/audit/audit.module';
import { VocabularyModule } from './modules/vocabulary/vocabulary.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AlgorithmModule } from './modules/algorithm/algorithm.module';
import { ReviewModule } from './modules/review/review.module';
import { LearningModule } from './modules/learning/learning.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: getRedisConnectionOptions(),
    }),
    RedisModule,
    AuditModule,
    VocabularyModule,
    AuthModule,
    UsersModule,
    AlgorithmModule,
    ReviewModule,
    LearningModule,
    GamificationModule,
  ],
})
export class AppModule {}

export function configureNestApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => {
        const details = errors.flatMap((err) =>
          err.constraints ? Object.values(err.constraints) : [`${err.property} is invalid`],
        );
        return new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Dữ liệu gửi lên không hợp lệ',
          details,
        });
      },
    }),
  );
  app.useGlobalInterceptors(new TransformResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
}
