import { Injectable } from '@nestjs/common';

interface AttemptRecord {
  failures: number;
  /** Momento (epoch ms) en que expira la ventana o el bloqueo vigente. */
  expiresAt: number;
  lockedUntil: number | null;
}

/**
 * Contador de intentos fallidos con bloqueo temporal, para credenciales y
 * códigos MFA.
 *
 * Sin esto, /auth/mfa/verify acepta intentos ilimitados de un código de 6
 * dígitos: con un solo millón de combinaciones por paso TOTP de 30s, un
 * atacante que ya tenga la contraseña puede recorrer el espacio completo y
 * eludir el segundo factor. El mismo problema aplica a /auth/login para
 * adivinar contraseñas.
 *
 * LIMITACIÓN CONOCIDA: el estado vive en memoria del proceso. Sirve para un
 * despliegue de una sola instancia, que es el caso actual, pero no se comparte
 * entre réplicas ni sobrevive a un reinicio. Si el backend se escala
 * horizontalmente, este contador debe moverse a Redis o a una tabla de la base
 * de datos para que el límite sea real.
 */
@Injectable()
export class AttemptLimiterService {
  /** Fallos tolerados dentro de la ventana antes de bloquear. */
  private static readonly MAX_FAILURES = 5;
  /** Ventana en la que se acumulan los fallos. */
  private static readonly WINDOW_MS = 15 * 60 * 1000;
  /** Duración del bloqueo una vez superado el umbral. */
  private static readonly LOCKOUT_MS = 15 * 60 * 1000;
  /** Tope de llaves vivas, para que la tabla no crezca sin límite. */
  private static readonly MAX_ENTRIES = 10_000;

  private readonly attempts = new Map<string, AttemptRecord>();

  /**
   * Segundos que faltan para poder reintentar, o null si la llave no está
   * bloqueada. El llamador decide qué error levantar.
   */
  retryAfterSeconds(key: string): number | null {
    const record = this.attempts.get(key);
    if (!record?.lockedUntil) return null;

    const now = Date.now();
    if (record.lockedUntil <= now) {
      this.attempts.delete(key);
      return null;
    }
    return Math.ceil((record.lockedUntil - now) / 1000);
  }

  /**
   * Registra un fallo. Devuelve true si con este fallo la llave quedó
   * bloqueada, para que el llamador pueda auditarlo.
   */
  recordFailure(key: string): boolean {
    const now = Date.now();
    this.prune(now);

    const existing = this.attempts.get(key);
    const record: AttemptRecord =
      existing && existing.expiresAt > now
        ? existing
        : { failures: 0, expiresAt: now + AttemptLimiterService.WINDOW_MS, lockedUntil: null };

    record.failures += 1;

    if (record.failures >= AttemptLimiterService.MAX_FAILURES) {
      record.lockedUntil = now + AttemptLimiterService.LOCKOUT_MS;
      record.expiresAt = record.lockedUntil;
      this.attempts.set(key, record);
      return true;
    }

    this.attempts.set(key, record);
    return false;
  }

  /** Limpia el historial tras un intento exitoso. */
  reset(key: string): void {
    this.attempts.delete(key);
  }

  /**
   * Descarta entradas vencidas. Si aun así se supera el tope, se vacía la
   * tabla entera: perder el conteo es preferible a crecer sin control, y el
   * escenario solo se alcanza bajo un volumen de llaves anómalo.
   */
  private prune(now: number): void {
    for (const [key, record] of this.attempts) {
      if (record.expiresAt <= now && (!record.lockedUntil || record.lockedUntil <= now)) {
        this.attempts.delete(key);
      }
    }
    if (this.attempts.size > AttemptLimiterService.MAX_ENTRIES) {
      this.attempts.clear();
    }
  }
}
