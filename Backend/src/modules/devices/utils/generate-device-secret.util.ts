import { randomBytes } from 'crypto';

/** Sinh secret key ngẫu nhiên (32 byte, hex) cho Device dùng để lấy JWT — CHỈ trả về 1 lần lúc tạo/regenerate */
export function generateDeviceSecret(): string {
  return randomBytes(32).toString('hex');
}
