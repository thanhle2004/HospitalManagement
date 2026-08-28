import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const PatientPhoneVerificationResponseSchema = z.object({
  requiresRegistration: z.boolean(),
  registrationToken: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
});

export type PatientPhoneVerificationResponse =
  | { requiresRegistration: true; registrationToken: string }
  | {
      requiresRegistration: false;
      accessToken: string;
      refreshToken: string;
    };

export class PatientPhoneVerificationResponseDto extends createZodDto(
  PatientPhoneVerificationResponseSchema,
) {}
