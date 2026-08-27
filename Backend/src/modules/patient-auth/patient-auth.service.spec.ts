import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OtpPurpose } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { PatientsRepository } from '../patients/patients.repository';
import { OtpSenderService } from './otp-sender.service';
import { PatientAuthService } from './patient-auth.service';
import { PatientOtpRepository } from './repositories/patient-otp.repository';
import { PatientSessionRepository } from './repositories/patient-session.repository';

function makeConfig(): ConfigService {
  const values: Record<string, string | number> = {
    'jwt.patientAccessSecret': 'patient-access-secret',
    'jwt.patientAccessExpiresIn': '30m',
    'jwt.patientRefreshSecret': 'patient-refresh-secret',
    'jwt.patientRefreshExpiresIn': '30d',
    'otp.length': 6,
  };
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('PatientAuthService session safety', () => {
  it('returns the same generic challenge response without sending OTP when account state mismatches', async () => {
    const patientsRepository = {
      findByPhone: jest.fn().mockResolvedValue({ id: 'patient-1' }),
    };
    const otpRepository = { create: jest.fn() };
    const otpSender = { sendOtp: jest.fn() };
    const service = new PatientAuthService(
      patientsRepository as unknown as PatientsRepository,
      otpRepository as unknown as PatientOtpRepository,
      {} as PatientSessionRepository,
      otpSender as unknown as OtpSenderService,
      {} as JwtService,
      makeConfig(),
      {} as PrismaService,
    );

    await expect(
      service.requestOtpChallenge({
        phone: '0900000001',
        purpose: OtpPurpose.REGISTER,
      }),
    ).resolves.toEqual({
      message: 'Nếu yêu cầu hợp lệ, mã OTP sẽ được gửi',
    });
    expect(otpRepository.create).not.toHaveBeenCalled();
    expect(otpSender.sendOtp).not.toHaveBeenCalled();
  });

  it('atomically consumes a valid OTP before creating a patient session', async () => {
    const codeHash = await bcrypt.hash('123456', 4);
    const tx = { marker: 'transaction' };
    const patientsRepository = {
      findByPhone: jest.fn().mockResolvedValue({
        id: 'patient-1',
        phone: '0900000001',
        tokenVersion: 0,
      }),
    };
    const otpRepository = {
      findValidForVerify: jest.fn().mockResolvedValue({
        id: 'otp-1',
        codeHash,
        attempts: 0,
        maxAttempts: 5,
        purpose: OtpPurpose.LOGIN,
      }),
      consumeIfUnused: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const sessionRepository = {
      create: jest.fn().mockResolvedValue(undefined),
    };
    const jwtService = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('patient-access')
        .mockResolvedValueOnce('patient-refresh'),
    };
    const prisma = {
      transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new PatientAuthService(
      patientsRepository as unknown as PatientsRepository,
      otpRepository as unknown as PatientOtpRepository,
      sessionRepository as unknown as PatientSessionRepository,
      {} as OtpSenderService,
      jwtService as unknown as JwtService,
      makeConfig(),
      prisma as unknown as PrismaService,
    );

    await expect(
      service.verifyLogin({ phone: '0900000001', otp: '123456' }),
    ).resolves.toEqual({
      accessToken: 'patient-access',
      refreshToken: 'patient-refresh',
    });

    expect(otpRepository.consumeIfUnused).toHaveBeenCalledWith('otp-1', tx);
    expect(sessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        patient: { connect: { id: 'patient-1' } },
        refreshTokenHash: expect.any(String),
      }),
      tx,
    );
    expect(
      otpRepository.consumeIfUnused.mock.invocationCallOrder[0],
    ).toBeLessThan(sessionRepository.create.mock.invocationCallOrder[0]);
  });

  it('rejects an OTP replay without creating another session', async () => {
    const codeHash = await bcrypt.hash('123456', 4);
    const patientsRepository = {
      findByPhone: jest.fn().mockResolvedValue({
        id: 'patient-1',
        phone: '0900000001',
        tokenVersion: 0,
      }),
    };
    const otpRepository = {
      findValidForVerify: jest.fn().mockResolvedValue({
        id: 'otp-1',
        codeHash,
        attempts: 0,
        maxAttempts: 5,
      }),
      consumeIfUnused: jest.fn().mockResolvedValue({ count: 0 }),
    };
    const sessionRepository = { create: jest.fn() };
    const prisma = {
      transaction: jest.fn((callback) => callback({ marker: 'tx' })),
    };
    const service = new PatientAuthService(
      patientsRepository as unknown as PatientsRepository,
      otpRepository as unknown as PatientOtpRepository,
      sessionRepository as unknown as PatientSessionRepository,
      {} as OtpSenderService,
      {} as JwtService,
      makeConfig(),
      prisma as unknown as PrismaService,
    );

    await expect(
      service.verifyLogin({ phone: '0900000001', otp: '123456' }),
    ).rejects.toThrow('Mã OTP đã được sử dụng');
    expect(sessionRepository.create).not.toHaveBeenCalled();
  });

  it('revokes sessions and increments patient token version together on logout', async () => {
    const tx = { marker: 'transaction' };
    const patientsRepository = {
      incrementTokenVersion: jest.fn().mockResolvedValue(undefined),
    };
    const sessionRepository = {
      revokeAllForPatient: jest.fn().mockResolvedValue({ count: 2 }),
    };
    const prisma = {
      transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new PatientAuthService(
      patientsRepository as unknown as PatientsRepository,
      {} as PatientOtpRepository,
      sessionRepository as unknown as PatientSessionRepository,
      {} as OtpSenderService,
      {} as JwtService,
      makeConfig(),
      prisma as unknown as PrismaService,
    );

    await service.logout('patient-1');

    expect(sessionRepository.revokeAllForPatient).toHaveBeenCalledWith(
      'patient-1',
      tx,
    );
    expect(patientsRepository.incrementTokenVersion).toHaveBeenCalledWith(
      'patient-1',
      tx,
    );
  });

  it('consumes all duplicate refresh-token hashes in one atomic rotation', async () => {
    const tx = { marker: 'transaction' };
    const patientsRepository = {
      findById: jest.fn().mockResolvedValue({
        id: 'patient-1',
        tokenVersion: 3,
      }),
    };
    const sessionRepository = {
      consumeValid: jest.fn().mockResolvedValue({ count: 2 }),
      create: jest.fn().mockResolvedValue(undefined),
    };
    const jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'patient-1',
        tokenVersion: 3,
      }),
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('new-access')
        .mockResolvedValueOnce('new-refresh'),
    };
    const prisma = {
      transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new PatientAuthService(
      patientsRepository as unknown as PatientsRepository,
      {} as PatientOtpRepository,
      sessionRepository as unknown as PatientSessionRepository,
      {} as OtpSenderService,
      jwtService as unknown as JwtService,
      makeConfig(),
      prisma as unknown as PrismaService,
    );

    await expect(
      service.refresh({ refreshToken: 'patient-refresh' }),
    ).resolves.toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    expect(sessionRepository.consumeValid).toHaveBeenCalledWith(
      'patient-1',
      expect.any(String),
      tx,
    );
    expect(jwtService.signAsync).toHaveBeenLastCalledWith(
      { sub: 'patient-1', tokenVersion: 3 },
      expect.objectContaining({ jwtid: expect.any(String) }),
    );
  });
});
