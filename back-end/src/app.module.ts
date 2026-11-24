import { Module, INestApplication, ValidationPipe, BadRequestException } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './config/database.config';
import { VocabularyModule } from './modules/vocabulary/vocabulary.module';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    VocabularyModule,
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
