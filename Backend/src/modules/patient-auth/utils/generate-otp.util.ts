import { randomInt } from 'crypto';

/** Sinh mã OTP dạng số, độ dài tuỳ chỉnh (mặc định 6 chữ số), dùng crypto.randomInt (CSPRNG) thay vì Math.random() */
export function generateOtpCode(length = 6): string {
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return randomInt(min, max + 1).toString();
}
