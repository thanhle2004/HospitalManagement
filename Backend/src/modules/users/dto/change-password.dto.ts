import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ChangePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Mật khẩu cũ không được để trống'),
    newPassword: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự'),
  })
  .strict();

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
