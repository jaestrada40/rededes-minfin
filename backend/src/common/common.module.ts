import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter';

/**
 * El filtro global se registra como proveedor (APP_FILTER) y no con
 * app.useGlobalFilters() en main.ts: bootstrap() no corre en las pruebas, que
 * arman la aplicación con Test.createTestingModule, así que registrarlo allí
 * dejaba a los e2e sin el mapeo de errores de Prisma —un slug duplicado
 * respondía 500 en pruebas y 409 en producción.
 */
@Module({
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class CommonModule {}
