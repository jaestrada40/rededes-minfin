import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET no está definida en el entorno');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  // Passport acepta un valor síncrono; no hay nada que esperar aquí.
  async validate(payload: { sub: string }) {
    // No confiar en el rol incluido en un JWT ya emitido: así una baja o un
    // cambio de privilegios es efectivo inmediatamente, no al expirar el JWT.
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        isActive: true,
        role: { select: { name: true } },
      },
    });
    if (!user?.isActive) throw new UnauthorizedException();
    return { id: user.id, email: user.email, role: user.role.name };
  }
}
