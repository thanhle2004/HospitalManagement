import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { UsersRepository } from '../users/users.repository';

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
    const service = new AuthService(
      usersRepository as unknown as UsersRepository,
      refreshTokenRepository as unknown as RefreshTokenRepository,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
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
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user: { connect: { id: 'user-1' } },
        tokenHash: expect.not.stringMatching('refresh-token-value'),
        expiresAt: expect.any(Date),
      }),
    );
  });
});
