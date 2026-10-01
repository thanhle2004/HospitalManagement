import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ActivityLogController } from '../modules/activity-log/activity-log.controller';
import { AdminQueueController } from '../modules/admin-queue/admin-queue.controller';
import { DoctorController } from '../modules/doctor/doctor.controller';
import { RbacController } from '../modules/rbac/rbac.controller';
import { PERMISSIONS_KEY } from '../modules/rbac/decorators/permissions.decorator';
import { PermissionsGuard } from '../modules/rbac/guards/permissions.guard';
import { StaffController } from '../modules/users/staff.controller';

describe('Staff role × critical endpoint authorization matrix', () => {
  const endpointPermissions = [
    [RbacController, 'rbac.manage'],
    [StaffController, 'staff.manage'],
    [DoctorController, 'doctor.workflow'],
    [ActivityLogController, 'audit.read'],
    [AdminQueueController, 'queue.manage'],
  ] as const;

  it.each(endpointPermissions)('%p declares the expected permission %s', (controller, permission) => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, controller)).toEqual([permission]);
  });

  const principals = {
    ADMIN: ['rbac.manage', 'staff.manage', 'audit.read', 'queue.manage'],
    DOCTOR: ['doctor.workflow'],
    MULTI_ROLE: ['doctor.workflow', 'audit.read'],
    NURSE: [],
  } as const;

  it.each([
    ['ADMIN', 'staff.manage', true],
    ['ADMIN', 'doctor.workflow', false],
    ['DOCTOR', 'doctor.workflow', true],
    ['DOCTOR', 'staff.manage', false],
    ['MULTI_ROLE', 'doctor.workflow', true],
    ['MULTI_ROLE', 'audit.read', true],
    ['NURSE', 'doctor.workflow', false],
    ['NURSE', 'staff.manage', false],
  ] as const)('%s permission %s => %s', async (principal, permission, allowed) => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue([permission]) };
    const rbac = { userHasEveryPermission: jest.fn(async () => principals[principal].includes(permission as never)) };
    const guard = new PermissionsGuard(reflector as unknown as Reflector, rbac as never);
    const context = { switchToHttp: () => ({ getRequest: () => ({ user: { sub: principal.toLowerCase(), role: principal === 'ADMIN' ? UserRole.ADMIN : UserRole.DOCTOR } }) }), getHandler: jest.fn(), getClass: jest.fn() } as never;
    await expect(guard.canActivate(context)).resolves.toBe(allowed);
  });
});
