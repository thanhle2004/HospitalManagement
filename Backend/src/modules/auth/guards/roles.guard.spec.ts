import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function contextFor(role?: UserRole): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(
        role ? { user: { sub: 'user-1', role, tokenVersion: 0 } } : {},
      ),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard deny matrix', () => {
  it('allows an authenticated Staff route with no role restriction', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(contextFor(UserRole.DOCTOR))).toBe(true);
  });

  it('denies Doctor access to an Admin-only resource', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(contextFor(UserRole.DOCTOR))).toBe(false);
  });

  it('allows Admin access to an Admin-only resource', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    };
    const guard = new RolesGuard(reflector as unknown as Reflector);

    expect(guard.canActivate(contextFor(UserRole.ADMIN))).toBe(true);
  });
});
