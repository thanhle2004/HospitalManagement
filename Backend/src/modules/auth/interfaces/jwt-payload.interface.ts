import { UserRole } from '@prisma/client';

export interface JwtPayload {
  /** user id (uuid) */
  sub: string;
  email: string;
  role: UserRole;
}
