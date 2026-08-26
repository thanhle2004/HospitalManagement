import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RefreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1, 'refreshToken không được để trống'),
  })
  .strict();

export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}
