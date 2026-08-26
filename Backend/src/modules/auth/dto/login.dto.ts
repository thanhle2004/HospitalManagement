import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const LoginSchema = z
  .object({
    email: z.string().email('Email không hợp lệ'),
    password: z.string().min(1, 'Password không được để trống'),
  })
  .strict();

export class LoginDto extends createZodDto(LoginSchema) {}
