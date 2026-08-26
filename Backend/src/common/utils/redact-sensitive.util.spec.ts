import { redactSensitiveText } from './redact-sensitive.util';

describe('redactSensitiveText', () => {
  it.each([
    ['authorization=Bearer abc.def.ghi', 'authorization=[REDACTED]'],
    ['password: "super-secret"', 'password: [REDACTED]'],
    ['otp=123456', 'otp=[REDACTED]'],
    [
      'mysql://hospital:private-password@mysql:3306/hospital_management',
      'mysql://[REDACTED]@mysql:3306/hospital_management',
    ],
  ])('redacts %s', (input, expected) => {
    expect(redactSensitiveText(input)).toBe(expected);
  });

  it('keeps operational context', () => {
    expect(redactSensitiveText('connection timed out after 2000ms')).toBe(
      'connection timed out after 2000ms',
    );
  });
});
