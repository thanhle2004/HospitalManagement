import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Giới hạn route chỉ cho 1 hoặc nhiều role cụ thể. Không dùng = mọi user đã login đều vào được. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
