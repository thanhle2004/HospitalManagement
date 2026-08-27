import { UserRole } from '@prisma/client';

export interface JwtPayload {
  /** user id (uuid) */
  sub: string;
  role: UserRole;
  /** Optional để access token đã cấp trước migration (mặc định version 0) vẫn dùng được. */
  tokenVersion?: number;
  /** Chỉ còn để đọc token legacy; token mới không nhúng email/PII. */
  email?: string;
}
