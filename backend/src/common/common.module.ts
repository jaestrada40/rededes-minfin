import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HttpExceptionFilter } from './filters/http-exception.filter';

/**
 * El filtro global se registra como proveedor (APP_FILTER) y no con
 * app.useGlobalFilters() en main.ts: bootstrap() no corre en las pruebas, que
 * arman la aplicación con Test.createTestingModule, así que registrarlo allí
 * dejaba a los e2e sin el mapeo de errores de Prisma —un slug duplicado
 * respondía 500 en pruebas y 409 en producción. Mismo motivo para el
 * ThrottlerGuard (APP_GUARD) a continuación.
 *
 * Límite de tasa global por IP: los endpoints /public/* (consumidos sin
 * autenticación por el plugin de WordPress y por cualquiera en internet) no
 * tenían ningún límite propio, solo el caché de 60s del lado del plugin —
 * quien llame a la API directamente lo evita y puede golpear la base de
 * datos sin freno en cada petición. Los endpoints autenticados ya exigen un
 * JWT válido, y login/MFA tienen su propio límite más estricto
 * (AttemptLimiterService), así que este límite más amplio es solo una
 * segunda capa para ellos.
 */
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class CommonModule {}
