import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirebasePhoneAuthService } from './firebase-phone-auth.service';

jest.mock('firebase-admin/app', () => ({
  applicationDefault: jest.fn(),
  cert: jest.fn(),
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(),
}));
jest.mock('firebase-admin/auth', () => ({ getAuth: jest.fn() }));

describe('FirebasePhoneAuthService', () => {
  const createService = (verifyIdToken: jest.Mock) => {
    const config = { get: jest.fn() } as unknown as ConfigService;
    const service = new FirebasePhoneAuthService(config);
    Object.assign(service, { auth: { verifyIdToken } });
    return service;
  };

  it('accepts only a Firebase phone token and normalizes it for the database', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({
      firebase: { sign_in_provider: 'phone' },
      phone_number: '+84901234567',
    });

    await expect(
      createService(verifyIdToken).verifyPhoneNumber('firebase-token'),
    ).resolves.toBe('0901234567');
    expect(verifyIdToken).toHaveBeenCalledWith('firebase-token', true);
  });

  it('rejects a token created through another Firebase provider', async () => {
    const service = createService(
      jest.fn().mockResolvedValue({
        firebase: { sign_in_provider: 'password' },
        phone_number: '+84901234567',
      }),
    );

    await expect(service.verifyPhoneNumber('firebase-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a non-Vietnamese mobile phone claim', async () => {
    const service = createService(
      jest.fn().mockResolvedValue({
        firebase: { sign_in_provider: 'phone' },
        phone_number: '+12025550123',
      }),
    );

    await expect(service.verifyPhoneNumber('firebase-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('does not expose Firebase verification details to the client', async () => {
    const service = createService(
      jest.fn().mockRejectedValue(new Error('certificate fetch failed')),
    );

    await expect(service.verifyPhoneNumber('firebase-token')).rejects.toMatchObject({
      message: 'Phiên xác thực Firebase không hợp lệ hoặc đã hết hạn',
    });
  });

  it('reports missing Firebase configuration as a service outage', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    const service = new FirebasePhoneAuthService(config);

    await expect(service.verifyPhoneNumber('firebase-token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
