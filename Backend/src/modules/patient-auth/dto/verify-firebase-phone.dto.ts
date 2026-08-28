import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const VerifyFirebasePhoneSchema = z
  .object({
    firebaseIdToken: z
      .string()
      .min(1, 'Thiếu Firebase ID token')
      .max(4096, 'Firebase ID token không hợp lệ'),
  })
  .strict();

export class VerifyFirebasePhoneDto extends createZodDto(
  VerifyFirebasePhoneSchema,
) {}
