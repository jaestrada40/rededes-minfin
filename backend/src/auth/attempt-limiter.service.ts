import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Rate limiting durable y compartido por todas las réplicas. */
@Injectable()
export class AttemptLimiterService {
  private static readonly MAX_FAILURES = 5;
  private static readonly WINDOW_MS = 5 * 60 * 1000;
  private static readonly LOCKOUT_MS = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {}

  async retryAfterSeconds(key: string): Promise<number | null> {
    const record = await this.prisma.authAttempt.findUnique({ where: { key } });
    if (!record?.lockedUntil || record.lockedUntil <= new Date()) return null;
    return Math.ceil((record.lockedUntil.getTime() - Date.now()) / 1000);
  }

  async recordFailure(
    key: string,
    maxFailures = AttemptLimiterService.MAX_FAILURES,
  ): Promise<boolean> {
    const { lockedUntil } = await this.increment(key, maxFailures);
    return !!lockedUntil;
  }

  /**
   * Reserva un intento ANTES de evaluar el secreto (código TOTP). El
   * incremento es atómico, así que aunque lleguen N peticiones a la vez solo
   * `maxAttempts` de ellas obtienen `true`; el resto se rechaza sin evaluarse.
   * Quien acierta debe llamar a `reset(key)`; el intento reservado cuenta como
   * fallo mientras no se haga.
   */
  async reserveAttempt(
    key: string,
    maxAttempts = AttemptLimiterService.MAX_FAILURES,
  ): Promise<boolean> {
    const { failures } = await this.increment(key, maxAttempts);
    return failures <= maxAttempts;
  }

  /**
   * Devuelve un intento reservado. Se usa cuando el código era correcto pero ya
   * se había gastado en el mismo intervalo de 30 s ('replayed'): no es una
   * adivinanza, así que no debe acercar a un usuario legítimo al bloqueo.
   */
  async releaseAttempt(key: string): Promise<void> {
    await this.prisma.authAttempt.updateMany({
      where: { key, failures: { gt: 0 } },
      data: { failures: { decrement: 1 } },
    });
  }

  private async increment(
    key: string,
    maxFailures: number,
  ): Promise<{ failures: number; lockedUntil: Date | null }> {
    // Una sola sentencia evita que peticiones concurrentes pierdan incrementos.
    const rows = await this.prisma.$queryRaw<
      { failures: number; lockedUntil: Date | null }[]
    >(
      Prisma.sql`
        INSERT INTO "AuthAttempt" ("key", "failures", "expiresAt", "lockedUntil", "updatedAt")
        VALUES (${key}, 1, NOW() + INTERVAL '5 minutes', NULL, NOW())
        ON CONFLICT ("key") DO UPDATE SET
          "failures" = CASE WHEN "AuthAttempt"."expiresAt" > NOW()
            THEN "AuthAttempt"."failures" + 1 ELSE 1 END,
          "lockedUntil" = CASE WHEN
            (CASE WHEN "AuthAttempt"."expiresAt" > NOW() THEN "AuthAttempt"."failures" + 1 ELSE 1 END) >= ${maxFailures}
            THEN NOW() + INTERVAL '5 minutes' ELSE NULL END,
          "expiresAt" = CASE WHEN
            (CASE WHEN "AuthAttempt"."expiresAt" > NOW() THEN "AuthAttempt"."failures" + 1 ELSE 1 END) >= ${maxFailures}
            THEN NOW() + INTERVAL '5 minutes' ELSE NOW() + INTERVAL '5 minutes' END,
          "updatedAt" = NOW()
        RETURNING "failures", "lockedUntil"
      `,
    );
    return {
      failures: Number(rows[0]?.failures ?? 1),
      lockedUntil: rows[0]?.lockedUntil ?? null,
    };
  }

  async reset(key: string): Promise<void> {
    await this.prisma.authAttempt.deleteMany({ where: { key } });
  }
}
