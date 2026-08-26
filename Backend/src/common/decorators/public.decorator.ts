import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Đánh dấu route/controller KHÔNG cần JWT — mặc định mọi route đều bị JwtAuthGuard chặn */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
