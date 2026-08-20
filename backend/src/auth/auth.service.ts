import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  private signInternal(payload: Record<string, unknown>): string {
    return this.jwt.sign(payload, { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '5m' });
  }

  decodeSetupSecret(token: string): string {
    const payload = this.jwt.verify(token, { secret: process.env.JWT_ACCESS_SECRET }) as { secret: string };
    return payload.secret;
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!user || !valid) {
      await this.audit.log({
        userEmail: email,
        userRole: 'desconocido',
        action: 'Intento de inicio de sesión',
        module: 'Seguridad',
        result: 'Fallido',
      });
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.mfaEnabled) {
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

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri('usuario', 'MINFIN Gestor Social', secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    const verifyToken = this.jwt.sign(
      { purpose: 'mfa-setup-verify', userId: payload.userId, secret },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '10m' },
    );

    return { qrDataUrl, verifyToken };
  }

  async mfaSetupVerify(verifyToken: string, code: string, ip?: string): Promise<TokenPair> {
    const payload = this.jwt.verify(verifyToken, { secret: process.env.JWT_ACCESS_SECRET }) as {
      purpose: string;
      userId: string;
      secret: string;
    };
    if (payload.purpose !== 'mfa-setup-verify') throw new UnauthorizedException('Token inválido');

    const validCode = authenticator.check(code, payload.secret);
    if (!validCode) {
      await this.audit.log({
        userId: payload.userId,
        userEmail: 'desconocido',
        userRole: 'desconocido',
        action: 'Código MFA inválido durante configuración',
        module: 'MFA',
        result: 'Fallido',
        ipAddress: ip,
      });
      throw new UnauthorizedException('Código MFA inválido');
    }

    await this.prisma.mfaSettings.create({
      data: { userId: payload.userId, secretEncrypted: payload.secret, verifiedAt: new Date() },
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

    const settings = await this.prisma.mfaSettings.findUnique({ where: { userId: payload.userId } });
    const validCode = settings ? authenticator.check(code, settings.secretEncrypted) : false;

    if (!validCode) {
      await this.audit.log({
        userId: payload.userId,
        userEmail: 'desconocido',
        userRole: 'desconocido',
        action: 'Código MFA inválido en inicio de sesión',
        module: 'MFA',
        result: 'Fallido',
        ipAddress: ip,
      });
      throw new UnauthorizedException('Código MFA inválido');
    }

    await this.prisma.user.update({ where: { id: payload.userId }, data: { lastLoginAt: new Date() } });
    return this.issueTokens(payload.userId, ip);
  }

  private async issueTokens(userId: string, ip?: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { role: true } });

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
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!stored) throw new UnauthorizedException('Refresh token inválido o expirado');

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
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
