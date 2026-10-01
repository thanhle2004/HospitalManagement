import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ChangePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, 'Mật khẩu cũ không được để trống').max(128),
    newPassword: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự').max(128),
  })
  .strict()
  .refine(({ oldPassword, newPassword }) => oldPassword !== newPassword, {
    message: 'Mật khẩu mới phải khác mật khẩu cũ',
    path: ['newPassword'],
  });

export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
