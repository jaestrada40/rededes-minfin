import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN no está definida en el entorno');
  }

  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '5mb' }));
  // El filtro global de excepciones se registra vía APP_FILTER en CommonModule,
  // para que las pruebas e2e usen el mismo mapeo de errores que producción.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.CORS_ORIGIN.split(','), credentials: true });
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
