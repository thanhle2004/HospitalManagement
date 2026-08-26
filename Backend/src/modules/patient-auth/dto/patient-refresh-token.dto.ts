import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const PatientRefreshTokenSchema = z
  .object({
    refreshToken: z.string().min(1, 'refreshToken không được để trống'),
  })
  .strict();

export class PatientRefreshTokenDto extends createZodDto(
  PatientRefreshTokenSchema,
) {}
