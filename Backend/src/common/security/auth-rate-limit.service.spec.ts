import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthRateLimitService } from './auth-rate-limit.service';

describe('AuthRateLimitService', () => {
  it('blocks the next request after the configured fixed-window limit', () => {
    const config = {
      get: jest.fn().mockReturnValue(true),
    } as unknown as ConfigService;
    const service = new AuthRateLimitService(config);

    service.assertAllowed('staff-login', ['doctor@example.test'], 2, 60_000);
    service.assertAllowed('staff-login', ['doctor@example.test'], 2, 60_000);

    expect(() =>
      service.assertAllowed('staff-login', ['doctor@example.test'], 2, 60_000),
    ).toThrow(HttpException);
  });

  it('keeps independent identities in separate counters', () => {
    const config = {
      get: jest.fn().mockReturnValue(true),
    } as unknown as ConfigService;
    const service = new AuthRateLimitService(config);

    service.assertAllowed('otp', ['0900000001'], 1, 60_000);

    expect(() =>
      service.assertAllowed('otp', ['0900000002'], 1, 60_000),
    ).not.toThrow();
  });
});
