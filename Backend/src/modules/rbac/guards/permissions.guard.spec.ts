import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const rbacService = { userHasEveryPermission: jest.fn() };
  const guard = new PermissionsGuard(reflector, rbacService as never);
  const context = (user?: object) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user }) }), getHandler: jest.fn(), getClass: jest.fn() }) as unknown as ExecutionContext;

  beforeEach(() => jest.clearAllMocks());

  it('allows authenticated routes without permission metadata', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  it('denies a protected route without a staff principal', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['rbac.manage']);
    await expect(guard.canActivate(context())).resolves.toBe(false);
  });

  it('delegates permission evaluation using the current database identity', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['rbac.manage']);
    rbacService.userHasEveryPermission.mockResolvedValue(true);
    await expect(guard.canActivate(context({ sub: 'admin-1', role: UserRole.ADMIN }))).resolves.toBe(true);
    expect(rbacService.userHasEveryPermission).toHaveBeenCalledWith('admin-1', ['rbac.manage'], UserRole.ADMIN);
  });
});
