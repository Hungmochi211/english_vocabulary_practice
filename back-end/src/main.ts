import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule, configureNestApp } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureNestApp(app);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('English Vocabulary Practice API')
    .setDescription('API hỗ trợ học từ vựng tiếng Anh thông minh (Oxford 3000)')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`Server listening on http://localhost:${port}/api/v1`);
  console.log(`Swagger UI available at http://localhost:${port}/api/docs`);
}

bootstrap();
