import { createHash } from 'crypto';

/**
 * Refresh token là chuỗi JWT dài, ngẫu nhiên, không đoán được (khác với
 * password) — nên dùng sha256 (nhanh, tra cứu bằng WHERE tokenHash = ?)
 * thay vì bcrypt (chậm, không tra cứu equality được).
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
