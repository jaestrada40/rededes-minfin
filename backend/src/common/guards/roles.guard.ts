import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      string[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // JwtStrategy deja aquí el usuario autenticado; se tipa explícitamente
    // porque getRequest() devuelve `any`.
    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: { role?: string } }>();
    return !!user?.role && requiredRoles.includes(user.role);
  }
}
