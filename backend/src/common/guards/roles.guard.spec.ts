import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function contextWith(role: string | undefined, requiredRoles: string[] | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) } as unknown as Reflector;
  const guard = new RolesGuard(reflector);
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    getHandler: () => {},
    getClass: () => {},
  } as unknown as ExecutionContext;
  return { guard, context };
}

describe('RolesGuard', () => {
  it('allows access when the user has one of the required roles', () => {
    const { guard, context } = contextWith('admin', ['admin', 'editor']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access when the user role is not included', () => {
    const { guard, context } = contextWith('viewer', ['admin', 'editor']);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('allows access when no roles are required', () => {
    const { guard, context } = contextWith('viewer', undefined);
    expect(guard.canActivate(context)).toBe(true);
  });
});
