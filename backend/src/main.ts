import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.CORS_ORIGIN) {
    throw new Error('CORS_ORIGIN no está definida en el entorno');
  }
  if (
    !process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_ACCESS_SECRET === 'change-me-access-secret'
  ) {
    throw new Error(
      'JWT_ACCESS_SECRET debe ser un secreto de producción único',
    );
  }
  if (
    !/^[0-9a-f]{64}$/i.test(process.env.MFA_ENCRYPTION_KEY ?? '') ||
    /^0{64}$/.test(process.env.MFA_ENCRYPTION_KEY ?? '')
  ) {
    throw new Error('MFA_ENCRYPTION_KEY debe ser una llave AES-256-GCM única');
  }

  const app = await NestFactory.create(AppModule);
  // Solo confiar en X-Forwarded-For cuando el proxy de despliegue se declara.
  if (process.env.TRUST_PROXY === 'true') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(json({ limit: '5mb' }));
  // El filtro global de excepciones se registra vía APP_FILTER en CommonModule,
  // para que las pruebas e2e usen el mismo mapeo de errores que producción.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: process.env.CORS_ORIGIN.split(','),
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 4000);
}
// Un fallo al arrancar debe terminar el proceso con código distinto de cero,
// no quedar como una promesa rechazada sin manejar.
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
