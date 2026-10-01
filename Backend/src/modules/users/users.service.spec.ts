import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

jest.mock('bcryptjs', () => ({
  ...jest.requireActual('bcryptjs'),
  hash: jest.fn().mockResolvedValue('hash'),
  compare: jest.fn(),
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
      {} as never,
    );

    await expect(service.findDoctorById('admin-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(usersRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('prevents an actor from locking their own active session', async () => {
    const service = new UsersService({} as UsersRepository, {} as PrismaService, { log: jest.fn() } as never, {} as never);
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
    const service = new UsersService(usersRepository as never, prisma as never, activityLog as never, {} as never);

    const result = await service.createStaff('admin-1', {
      email: 'nurse@example.com', password: 'password123', fullName: 'Điều dưỡng A', role: UserRole.NURSE, reason: 'Bổ sung nhân sự',
    });

    expect(result.role).toBe(UserRole.NURSE);
    expect(usersRepository.createStaff).toHaveBeenCalledWith(expect.objectContaining({ role: UserRole.NURSE, roleAssignments: expect.any(Object) }), tx);
    expect(activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'STAFF_CREATED' }), tx);
  });

  it('updates a self-profile and writes only redacted field metadata atomically', async () => {
    const tx = { marker: 'tx' };
    const stored = { id: 'user-1', role: UserRole.DOCTOR, status: UserStatus.ACTIVE, passwordHash: 'old', profile: { fullName: 'Tên mới' } };
    const usersRepository = { findById: jest.fn().mockResolvedValue(stored), updateProfile: jest.fn() };
    const activityLog = { log: jest.fn() };
    const prisma = { transaction: jest.fn((callback) => callback(tx)) };
    const service = new UsersService(usersRepository as never, prisma as never, activityLog as never, {} as never);

    await service.updateProfile('user-1', { fullName: 'Tên mới', phone: '0900000000' }, { requestId: 'req-1' });

    expect(usersRepository.updateProfile).toHaveBeenCalledWith('user-1', expect.any(Object), tx);
    expect(activityLog.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'STAFF_PROFILE_UPDATED',
      metadata: { requestId: 'req-1', changedFields: ['fullName', 'phone'] },
    }), tx);
    expect(JSON.stringify(activityLog.log.mock.calls)).not.toContain('0900000000');
  });

  it('changes password, increments token version, revokes sessions and audits in one transaction', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
    const tx = { marker: 'tx' };
    const usersRepository = { findById: jest.fn().mockResolvedValue({ id: 'user-1', passwordHash: 'old-hash' }), updatePassword: jest.fn() };
    const refreshTokens = { revokeAllForUser: jest.fn() };
    const activityLog = { log: jest.fn() };
    const prisma = { transaction: jest.fn((callback) => callback(tx)) };
    const service = new UsersService(usersRepository as never, prisma as never, activityLog as never, refreshTokens as never);

    await service.changePassword('user-1', { oldPassword: 'old-password', newPassword: 'new-password' }, { requestId: 'req-2' });

    expect(usersRepository.updatePassword).toHaveBeenCalledWith('user-1', 'hash', tx);
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user-1', tx);
    expect(activityLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'STAFF_PASSWORD_CHANGED', metadata: { requestId: 'req-2' } }), tx);
    expect(JSON.stringify(activityLog.log.mock.calls)).not.toContain('password');
  });

  it('does not enter the password transaction when the current credential is wrong', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
    const prisma = { transaction: jest.fn() };
    const service = new UsersService({ findById: jest.fn().mockResolvedValue({ passwordHash: 'old-hash' }) } as never, prisma as never, { log: jest.fn() } as never, { revokeAllForUser: jest.fn() } as never);

    await expect(service.changePassword('user-1', { oldPassword: 'wrong', newPassword: 'new-password' })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.transaction).not.toHaveBeenCalled();
  });

  it('propagates a session revocation failure so the password transaction rolls back', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
    const tx = { marker: 'tx' };
    const failure = new Error('session persistence unavailable');
    const prisma = { transaction: jest.fn((callback) => callback(tx)) };
    const service = new UsersService(
      { findById: jest.fn().mockResolvedValue({ passwordHash: 'old-hash' }), updatePassword: jest.fn() } as never,
      prisma as never,
      { log: jest.fn() } as never,
      { revokeAllForUser: jest.fn().mockRejectedValue(failure) } as never,
    );

    await expect(service.changePassword('user-1', { oldPassword: 'old-password', newPassword: 'new-password' })).rejects.toBe(failure);
    expect(prisma.transaction).toHaveBeenCalledTimes(1);
  });

  it('propagates an audit failure so password, token version and session changes roll back together', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);
    const tx = { marker: 'tx' };
    const failure = new Error('audit unavailable');
    const prisma = { transaction: jest.fn((callback) => callback(tx)) };
    const usersRepository = { findById: jest.fn().mockResolvedValue({ passwordHash: 'old-hash' }), updatePassword: jest.fn() };
    const refreshTokens = { revokeAllForUser: jest.fn() };
    const service = new UsersService(usersRepository as never, prisma as never, { log: jest.fn().mockRejectedValue(failure) } as never, refreshTokens as never);

    await expect(service.changePassword('user-1', { oldPassword: 'old-password', newPassword: 'new-password' })).rejects.toBe(failure);
    expect(usersRepository.updatePassword).toHaveBeenCalledWith('user-1', 'hash', tx);
    expect(refreshTokens.revokeAllForUser).toHaveBeenCalledWith('user-1', tx);
  });
});
