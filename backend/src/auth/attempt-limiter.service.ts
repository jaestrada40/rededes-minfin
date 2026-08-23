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

  async recordFailure(key: string, maxFailures = AttemptLimiterService.MAX_FAILURES): Promise<boolean> {
    // Una sola sentencia evita que peticiones concurrentes pierdan incrementos.
    const rows = await this.prisma.$queryRaw<{ lockedUntil: Date | null }[]>(
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
        RETURNING "lockedUntil"
      `,
    );
    return !!rows[0]?.lockedUntil;
  }

  async reset(key: string): Promise<void> {
    await this.prisma.authAttempt.deleteMany({ where: { key } });
  }
}
