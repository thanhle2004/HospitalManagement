import { ConfigService } from '@nestjs/config';
import { DeviceStatus, UserRole, UserStatus } from '@prisma/client';
import { DevicesRepository } from '../../devices/devices.repository';
import { PatientsRepository } from '../../patients/patients.repository';
import { UsersRepository } from '../../users/users.repository';
import { DeviceJwtStrategy } from '../../device-auth/strategies/device-jwt.strategy';
import { PatientJwtStrategy } from '../../patient-auth/strategies/patient-jwt.strategy';
import { JwtStrategy } from './jwt.strategy';

const config = {
  get: jest.fn().mockReturnValue('test-secret-with-safe-length'),
} as unknown as ConfigService;

describe('token-version JWT strategies', () => {
  it('rejects a stale Staff access token', async () => {
    const users = {
      findById: jest.fn().mockResolvedValue({
        id: 'user-1',
        role: UserRole.DOCTOR,
        status: UserStatus.ACTIVE,
        tokenVersion: 2,
      }),
    };
    const strategy = new JwtStrategy(
      config,
      users as unknown as UsersRepository,
    );

    await expect(
      strategy.validate({
        sub: 'user-1',
        role: UserRole.DOCTOR,
        tokenVersion: 1,
      }),
    ).rejects.toThrow('Phiên đăng nhập không còn hiệu lực');
  });

  it('rejects a stale Patient access token', async () => {
    const patients = {
      findById: jest.fn().mockResolvedValue({
        id: 'patient-1',
        tokenVersion: 4,
      }),
    };
    const strategy = new PatientJwtStrategy(
      config,
      patients as unknown as PatientsRepository,
    );

    await expect(
      strategy.validate({ sub: 'patient-1', tokenVersion: 3 }),
    ).rejects.toThrow('Phiên đăng nhập không còn hiệu lực');
  });

  it('rejects an inactive Device even when token version matches', async () => {
    const devices = {
      findById: jest.fn().mockResolvedValue({
        id: 'device-1',
        status: DeviceStatus.INACTIVE,
        tokenVersion: 1,
      }),
    };
    const strategy = new DeviceJwtStrategy(
      config,
      devices as unknown as DevicesRepository,
    );

    await expect(
      strategy.validate({ sub: 'device-1', tokenVersion: 1 }),
    ).rejects.toThrow('Phiên thiết bị không còn hiệu lực');
  });
});
