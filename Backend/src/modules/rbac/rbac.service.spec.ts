import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RbacService } from './rbac.service';

describe('RbacService', () => {
  const repository = {
    findPermissionCodesForUser: jest.fn(),
    findUser: jest.fn(),
    findRoleByCode: jest.fn(),
    assignRole: jest.fn(),
    revokeRole: jest.fn(),
    countUserRoles: jest.fn(),
    countRoleAssignments: jest.fn(),
    listStaff: jest.fn(),
    countStaff: jest.fn(),
  };
  const activityLog = { log: jest.fn() };
  const transaction = jest.fn(async (callback: (tx: object) => unknown) => callback({ tx: true }));
  const service = new RbacService(repository as never, { transaction } as never, activityLog as never);

  beforeEach(() => {
    jest.clearAllMocks();
    repository.findUser.mockResolvedValue({ id: 'user-1', deletedAt: null });
    repository.findRoleByCode.mockResolvedValue({ id: 7, code: 'DOCTOR' });
    repository.countRoleAssignments.mockResolvedValue(2);
  });

  it('does not revoke the final ADMIN assignment', async () => {
    repository.findRoleByCode.mockResolvedValue({ id: 1, code: 'ADMIN' });
    repository.countUserRoles.mockResolvedValue(2);
    repository.countRoleAssignments.mockResolvedValue(1);
    await expect(service.revokeRole('admin-1', 'user-1', 'ADMIN', 'Điều chỉnh quyền')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.revokeRole).not.toHaveBeenCalled();
  });

  it('uses assigned permission codes', async () => {
    repository.findPermissionCodesForUser.mockResolvedValue([{ code: 'rbac.manage' }]);
    await expect(service.userHasEveryPermission('user-1', ['rbac.manage'], UserRole.DOCTOR)).resolves.toBe(true);
  });

  it('returns a paginated Staff projection without credential fields', async () => {
    repository.listStaff.mockResolvedValue([{ id: 'user-1', email: 'doctor@example.com', role: UserRole.DOCTOR, status: 'ACTIVE', lastLoginAt: null, createdAt: new Date('2026-01-01'), profile: { fullName: 'Bác sĩ A', phone: null }, roleAssignments: [{ role: { code: 'DOCTOR' } }] }]);
    repository.countStaff.mockResolvedValue(1);
    const result = await service.listStaff({ page: 1, limit: 20 });
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(expect.objectContaining({ id: 'user-1', roles: ['DOCTOR'] }));
    expect(result.items[0]).not.toHaveProperty('passwordHash');
  });

  it('keeps a narrow ADMIN compatibility fallback during backfill', async () => {
    repository.findPermissionCodesForUser.mockResolvedValue([]);
    await expect(service.userHasEveryPermission('user-1', ['rbac.manage'], UserRole.ADMIN)).resolves.toBe(true);
    await expect(service.userHasEveryPermission('user-1', ['clinical.sign'], UserRole.ADMIN)).resolves.toBe(false);
  });

  it('assigns a role and audit event in the same transaction', async () => {
    await service.assignRole('admin-1', 'user-1', { roleCode: 'DOCTOR', reason: 'Điều chuyển nhân sự' });
    expect(repository.assignRole).toHaveBeenCalledWith('user-1', 7, 'admin-1', { tx: true });
    expect(activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'RBAC_ROLE_ASSIGNED', entityId: 'user-1' }), { tx: true });
  });

  it('does not revoke the final role', async () => {
    repository.countUserRoles.mockResolvedValue(1);
    await expect(service.revokeRole('admin-1', 'user-1', 'DOCTOR', 'Thay đổi nhiệm vụ')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.revokeRole).not.toHaveBeenCalled();
  });
});
