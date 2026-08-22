import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { AttemptLimiterService } from './attempt-limiter.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  // Hash señuelo con el mismo factor de costo (10) que los reales, sobre una
  // contraseña aleatoria que nadie conoce: se usa para que el login gaste el
  // mismo tiempo cuando el correo no existe. Nunca puede coincidir.
  private static readonly DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly attempts: AttemptLimiterService,
  ) {}

  // Rechaza el intento si la llave está bloqueada por fallos acumulados.
  private assertNotLocked(key: string): void {
    const retryAfter = this.attempts.retryAfterSeconds(key);
    if (retryAfter !== null) {
      throw new HttpException(
        `Demasiados intentos fallidos. Vuelva a intentar en ${Math.ceil(retryAfter / 60)} minuto(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private signInternal(payload: Record<string, unknown>): string {
    return this.jwt.sign(payload, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' });
  }

  // Format: <iv-hex>:<authTag-hex>:<ciphertext-hex>, AES-256-GCM with a random 12-byte IV per call.
  private encryptSecret(plain: string): string {
    const key = Buffer.from(process.env.MFA_ENCRYPTION_KEY!, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
  }

  private decryptSecret(encrypted: string): string {
    const key = Buffer.from(process.env.MFA_ENCRYPTION_KEY!, 'hex');
    const [ivHex, authTagHex, ciphertextHex] = encrypted.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const plain = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
    return plain.toString('utf8');
  }


  // Re-verificación de MFA ("step-up") para acciones sensibles ya
  // autenticadas (p. ej. crear un feed) — a diferencia del login, aquí no se
  // emiten tokens nuevos, solo se confirma el código TOTP contra el secreto
  // ya configurado del usuario.
  async verifyMfaCode(userId: string, code: string): Promise<boolean> {
    if (!code) return false;

    // Mismo límite que en el login: sin él, estas acciones sensibles serían
    // otro camino para adivinar el código TOTP por fuerza bruta.
    const attemptKey = `mfa-stepup:${userId}`;
    this.assertNotLocked(attemptKey);

    const settings = await this.prisma.mfaSettings.findUnique({ where: { userId } });
    // Un secreto todavía pendiente de verificar no sirve como segundo factor.
    if (!settings?.verifiedAt) return false;

    const valid = authenticator.check(code, this.decryptSecret(settings.secretEncrypted));
    if (valid) {
      this.attempts.reset(attemptKey);
    } else {
      this.attempts.recordFailure(attemptKey);
    }
    return valid;
  }

  async login(email: string, password: string) {
    const attemptKey = `login:${email.toLowerCase()}`;
    this.assertNotLocked(attemptKey);

    const user = await this.users.findByEmail(email);
    // Se compara siempre, incluso sin usuario: contra un hash señuelo del mismo
    // factor de costo. Si se omitiera bcrypt en la rama "correo desconocido",
    // la diferencia de tiempo revelaría qué direcciones tienen cuenta.
    const valid = await bcrypt.compare(password, user?.passwordHash ?? AuthService.DUMMY_PASSWORD_HASH);

    if (!user || !valid) {
      const locked = this.attempts.recordFailure(attemptKey);
      await this.audit.log({
        userEmail: email,
        userRole: 'desconocido',
        action: locked
          ? 'Intento de inicio de sesión; cuenta bloqueada temporalmente por intentos fallidos'
          : 'Intento de inicio de sesión',
        module: 'Seguridad',
        result: 'Fallido',
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    this.attempts.reset(attemptKey);

    if (!user.isActive) {
      await this.audit.log({
        userId: user.id,
        userEmail: email,
        userRole: 'desconocido',
        action: 'Intento de inicio de sesión de usuario inactivo',
        module: 'Seguridad',
        result: 'Fallido',
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.mfaEnabled) {
      const systemSettings = await this.settings.get();
      if (!systemSettings.mfaRequired) {
        await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return this.issueTokens(user.id);
      }

      const setupToken = this.signInternal({ purpose: 'mfa-setup', userId: user.id });
      return { requiresMfaSetup: true as const, setupToken };
    }

    const challengeToken = this.signInternal({ purpose: 'mfa-challenge', userId: user.id });
    return { requiresMfaCode: true as const, challengeToken };
  }

  async mfaSetup(setupToken: string) {
    const payload = this.jwt.verify(setupToken, { secret: process.env.JWT_ACCESS_SECRET }) as {
      purpose: string;
      userId: string;
    };
    if (payload.purpose !== 'mfa-setup') throw new UnauthorizedException('Token inválido');

    // Nunca se vuelve a emitir un secreto para quien ya tiene MFA verificado:
    // de lo contrario este endpoint sería una forma de reemplazar el segundo
    // factor de otra persona.
    const existing = await this.prisma.mfaSettings.findUnique({ where: { userId: payload.userId } });
    if (existing?.verifiedAt) {
      throw new UnauthorizedException('El MFA ya está configurado para esta cuenta.');
    }

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri('usuario', 'MINFIN Gestor Social', secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    // El secreto se guarda cifrado del lado del servidor, en estado pendiente
    // (verifiedAt null), y NO viaja en el token: un JWT va firmado pero no
    // cifrado, así que cualquiera que lo intercepte podría decodificar su
    // payload en base64 y quedarse con el secreto TOTP.
    await this.prisma.mfaSettings.upsert({
      where: { userId: payload.userId },
      update: { secretEncrypted: this.encryptSecret(secret), verifiedAt: null },
      create: { userId: payload.userId, secretEncrypted: this.encryptSecret(secret) },
    });

    const verifyToken = this.jwt.sign(
      { purpose: 'mfa-setup-verify', userId: payload.userId },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '10m' },
    );

    return { qrDataUrl, verifyToken };
  }

  async mfaSetupVerify(verifyToken: string, code: string, ip?: string): Promise<TokenPair> {
    const payload = this.jwt.verify(verifyToken, { secret: process.env.JWT_ACCESS_SECRET }) as {
      purpose: string;
      userId: string;
    };
    if (payload.purpose !== 'mfa-setup-verify') throw new UnauthorizedException('Token inválido');

    const attemptKey = `mfa-setup:${payload.userId}`;
    this.assertNotLocked(attemptKey);

    // El secreto se recupera del registro pendiente creado en mfaSetup; exigir
    // verifiedAt null evita que este flujo reinicie un MFA ya configurado.
    const pending = await this.prisma.mfaSettings.findUnique({ where: { userId: payload.userId } });
    if (!pending || pending.verifiedAt) {
      throw new UnauthorizedException('No hay una configuración de MFA pendiente para esta cuenta.');
    }

    const validCode = authenticator.check(code, this.decryptSecret(pending.secretEncrypted));
    if (!validCode) {
      const locked = this.attempts.recordFailure(attemptKey);
      await this.audit.log({
        userId: payload.userId,
        userEmail: 'desconocido',
        userRole: 'desconocido',
        action: locked
          ? 'Código MFA inválido durante configuración; verificación bloqueada temporalmente'
          : 'Código MFA inválido durante configuración',
        module: 'MFA',
        result: 'Fallido',
        ipAddress: ip,
      });
      throw new UnauthorizedException('Código MFA inválido');
    }

    this.attempts.reset(attemptKey);
    // El secreto ya está almacenado; aquí solo se marca como verificado.
    await this.prisma.mfaSettings.update({
      where: { userId: payload.userId },
      data: { verifiedAt: new Date() },
    });
    await this.prisma.user.update({ where: { id: payload.userId }, data: { mfaEnabled: true, lastLoginAt: new Date() } });

    return this.issueTokens(payload.userId, ip);
  }

  async mfaVerify(challengeToken: string, code: string, ip?: string): Promise<TokenPair> {
    const payload = this.jwt.verify(challengeToken, { secret: process.env.JWT_ACCESS_SECRET }) as {
      purpose: string;
      userId: string;
    };
    if (payload.purpose !== 'mfa-challenge') throw new UnauthorizedException('Token inválido');

    // El bloqueo se lleva por usuario, no por challengeToken: el token es un
    // JWT sin estado y el atacante puede acuñar uno nuevo cada 5 minutos, así
    // que contar por token no limitaría nada.
    const attemptKey = `mfa:${payload.userId}`;
    this.assertNotLocked(attemptKey);

    const settings = await this.prisma.mfaSettings.findUnique({ where: { userId: payload.userId } });
    const validCode = settings?.verifiedAt
      ? authenticator.check(code, this.decryptSecret(settings.secretEncrypted))
      : false;

    if (!validCode) {
      const locked = this.attempts.recordFailure(attemptKey);
      await this.audit.log({
        userId: payload.userId,
        userEmail: 'desconocido',
        userRole: 'desconocido',
        action: locked
          ? 'Código MFA inválido en inicio de sesión; verificación bloqueada temporalmente'
          : 'Código MFA inválido en inicio de sesión',
        module: 'MFA',
        result: 'Fallido',
        ipAddress: ip,
      });
      throw new UnauthorizedException('Código MFA inválido');
    }

    this.attempts.reset(attemptKey);
    await this.prisma.user.update({ where: { id: payload.userId }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(payload.userId, ip);
  }

  private async issueTokens(userId: string, ip?: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { role: true } });

    if (!user.isActive) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role.name },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as string,
      } as Parameters<JwtService['sign']>[1],
    );

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
    const days = Number(process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 7);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash, expiresAt, ipAddress: ip },
    });

    await this.audit.log({
      userId: user.id,
      userEmail: user.email,
      userRole: user.role.name,
      action: 'Inicio de sesión institucional exitoso',
      module: 'MFA',
      result: 'Exitoso',
      ipAddress: ip,
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  async refresh(refreshToken: string, ip?: string): Promise<TokenPair> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Look up without filtering on revokedAt/expiresAt first, so we can distinguish
    // "token not found at all" from "token found but already revoked" (reuse signal).
    const existing = await this.prisma.refreshToken.findFirst({ where: { tokenHash } });

    if (existing && existing.revokedAt) {
      // Reuse of a previously-rotated token: likely theft/replay. Revoke the whole family.
      await this.prisma.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.log({
        userId: existing.userId,
        userEmail: 'desconocido',
        userRole: 'desconocido',
        action: 'Reutilización de refresh token detectada; se revocaron todas las sesiones',
        module: 'Seguridad',
        result: 'Fallido',
        ipAddress: ip,
      });
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // Atomically gate on validity and revoke in one operation to close the check-then-act race.
    const result = await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new UnauthorizedException('Refresh token inválido o expirado');

    const stored = await this.prisma.refreshToken.findFirst({ where: { tokenHash } });
    if (!stored) throw new UnauthorizedException('Refresh token inválido o expirado');

    return this.issueTokens(stored.userId, ip);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
