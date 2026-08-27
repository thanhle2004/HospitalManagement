import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { UsersRepository } from '../users/users.repository';
import { PrismaService } from '../../prisma/prisma.service';

describe('AuthService characterization', () => {
  it('preserves the staff login and refresh-token persistence path', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const usersRepository = {
      findByEmail: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'doctor@example.test',
        passwordHash,
        role: UserRole.DOCTOR,
        status: UserStatus.ACTIVE,
        tokenVersion: 0,
      }),
      updateLastLogin: jest.fn().mockResolvedValue(undefined),
    };
    const refreshTokenRepository = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const jwtService = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('access-token-value')
        .mockResolvedValueOnce('refresh-token-value'),
    };
    const configuration = new Map<string, string>([
      ['jwt.accessSecret', 'staff-access-secret'],
      ['jwt.refreshSecret', 'staff-refresh-secret'],
      ['jwt.accessExpiresIn', '15m'],
      ['jwt.refreshExpiresIn', '7d'],
    ]);
    const configService = {
      get: jest.fn((key: string) => configuration.get(key)),
    };
    const prisma = {
      transaction: jest.fn(),
    };
    const service = new AuthService(
      usersRepository as unknown as UsersRepository,
      refreshTokenRepository as unknown as RefreshTokenRepository,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );

    const result = await service.login({
      email: 'doctor@example.test',
      password: 'correct-password',
    });

    expect(result).toEqual({
      accessToken: 'access-token-value',
      refreshToken: 'refresh-token-value',
    });
    expect(usersRepository.updateLastLogin).toHaveBeenCalledWith('user-1');
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      {
        sub: 'user-1',
        role: UserRole.DOCTOR,
        tokenVersion: 0,
      },
      expect.any(Object),
    );
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { connect: { id: 'user-1' } },
        tokenHash: expect.not.stringMatching('refresh-token-value'),
        expiresAt: expect.any(Date),
      }),
      undefined,
    );
  });

  it('consumes a refresh token atomically before issuing its replacement', async () => {
    const tx = { marker: 'transaction' };
    const usersRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        role: UserRole.DOCTOR,
        status: UserStatus.ACTIVE,
        tokenVersion: 2,
      }),
    };
    const refreshTokenRepository = {
      consumeValid: jest.fn().mockResolvedValue({ count: 2 }),
      create: jest.fn().mockResolvedValue(undefined),
    };
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'user-1',
        role: UserRole.DOCTOR,
        tokenVersion: 2,
      }),
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh'),
    };
    const configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          'jwt.refreshSecret': 'refresh-secret',
          'jwt.accessSecret': 'access-secret',
          'jwt.accessExpiresIn': '15m',
          'jwt.refreshExpiresIn': '7d',
        };
        return values[key];
      }),
    };
    const prisma = {
      transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new AuthService(
      usersRepository as unknown as UsersRepository,
      refreshTokenRepository as unknown as RefreshTokenRepository,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );

    await expect(
      service.refresh({ refreshToken: 'current-refresh' }),
    ).resolves.toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });

    expect(refreshTokenRepository.consumeValid).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      tx,
    );
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: expect.any(String) }),
      tx,
    );
  });

  it('rejects a refresh replay when another request already consumed it', async () => {
    const tx = { marker: 'transaction' };
    const usersRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        role: UserRole.DOCTOR,
        status: UserStatus.ACTIVE,
        tokenVersion: 0,
      }),
    };
    const refreshTokenRepository = {
      consumeValid: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(),
    };
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'user-1',
        role: UserRole.DOCTOR,
        tokenVersion: 0,
      }),
    };
    const configService = {
      get: jest.fn().mockReturnValue('refresh-secret'),
    };
    const prisma = {
      transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new AuthService(
      usersRepository as unknown as UsersRepository,
      refreshTokenRepository as unknown as RefreshTokenRepository,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );

    await expect(
      service.refresh({ refreshToken: 'replayed-refresh' }),
    ).rejects.toThrow('Refresh token đã bị thu hồi hoặc đã được sử dụng');
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  it('revokes refresh tokens and increments token version in one logout transaction', async () => {
    const tx = { marker: 'transaction' };
    const usersRepository = {
      incrementTokenVersion: jest.fn().mockResolvedValue(undefined),
    };
    const refreshTokenRepository = {
      revokeAllForUser: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const prisma = {
      transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new AuthService(
      usersRepository as unknown as UsersRepository,
      refreshTokenRepository as unknown as RefreshTokenRepository,
      {} as JwtService,
      {} as ConfigService,
      prisma as unknown as PrismaService,
    );

    await service.logout('user-1');

    expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(
      'user-1',
      tx,
    );
    expect(usersRepository.incrementTokenVersion).toHaveBeenCalledWith(
      'user-1',
      tx,
    );
  });
});
