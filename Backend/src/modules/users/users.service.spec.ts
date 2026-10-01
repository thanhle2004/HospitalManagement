import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

jest.mock('bcryptjs', () => ({
  ...jest.requireActual('bcryptjs'),
  hash: jest.fn().mockResolvedValue('hash'),
}));

describe('UsersService authorization boundaries', () => {
  it('does not let Doctor management endpoints target an Admin account', async () => {
    const usersRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'admin-1',
        role: UserRole.ADMIN,
      }),
      updateStatus: jest.fn(),
    };
    const service = new UsersService(
      usersRepository as unknown as UsersRepository,
      {} as PrismaService,
      { log: jest.fn() } as never,
    );

    await expect(service.findDoctorById('admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(usersRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('prevents an actor from locking their own active session', async () => {
    const service = new UsersService({} as UsersRepository, {} as PrismaService, { log: jest.fn() } as never);
    await expect(
      service.updateStaffStatus('user-1', 'user-1', { status: UserStatus.LOCKED, reason: 'Kiểm tra khóa' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates Staff, profile, initial role assignment and audit atomically', async () => {
    const createdAt = new Date();
    const stored = {
      id: 'staff-1', email: 'nurse@example.com', passwordHash: 'hash', role: UserRole.NURSE,
      status: UserStatus.ACTIVE, tokenVersion: 0, lastLoginAt: null, createdAt, updatedAt: createdAt,
      deletedAt: null, profile: { id: 'profile-1', userId: 'staff-1', fullName: 'Điều dưỡng A', phone: null, avatarUrl: null, gender: null, birthday: null, address: null, description: null, createdAt, updatedAt: createdAt },
    };
    const usersRepository = {
      findByEmail: jest.fn().mockResolvedValue(null),
      createStaff: jest.fn().mockResolvedValue(stored),
      createProfile: jest.fn().mockResolvedValue(stored.profile),
      findById: jest.fn().mockResolvedValue(stored),
    };
    const tx = { marker: 'tx' };
    const prisma = { transaction: jest.fn((callback) => callback(tx)) };
    const activityLog = { log: jest.fn() };
    const service = new UsersService(usersRepository as never, prisma as never, activityLog as never);

    const result = await service.createStaff('admin-1', {
      email: 'nurse@example.com', password: 'password123', fullName: 'Điều dưỡng A', role: UserRole.NURSE, reason: 'Bổ sung nhân sự',
    });

    expect(result.role).toBe(UserRole.NURSE);
    expect(usersRepository.createStaff).toHaveBeenCalledWith(expect.objectContaining({ role: UserRole.NURSE, roleAssignments: expect.any(Object) }), tx);
    expect(activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'STAFF_CREATED' }), tx);
  });
});
