import { randomBytes } from 'crypto';

/** Token QR ngẫu nhiên (32 byte, hex) — không đoán được, dùng crypto.randomBytes (CSPRNG) */
export function generateQrToken(): string {
  return randomBytes(32).toString('hex');
}
