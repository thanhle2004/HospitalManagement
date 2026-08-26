import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const PatientTokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export class PatientTokenResponseDto extends createZodDto(
  PatientTokenResponseSchema,
) {}
