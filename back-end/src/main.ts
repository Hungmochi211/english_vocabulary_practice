import { NestFactory } from '@nestjs/core';
import { AppModule, configureNestApp } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureNestApp(app);
  const port = Number(process.env.PORT || 3000);
  await app.listen(port);
  console.log(`Server listening on http://localhost:${port}/api/v1`);
}

bootstrap();
