import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  if (!process.env.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN no está definida en el entorno');
  }

  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '5mb' }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({ origin: process.env.CORS_ORIGIN.split(','), credentials: true });
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
