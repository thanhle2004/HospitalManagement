import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const StaffSessionResponseSchema = z.object({
  id: z.string().uuid(),
  deviceInfo: z.string().nullable(),
  ipAddress: z.string().nullable(),
  lastUsedAt: z.date().nullable(),
  createdAt: z.date(),
  expiresAt: z.date(),
  current: z.boolean(),
});

export class StaffSessionResponseDto extends createZodDto(
  StaffSessionResponseSchema,
) {}
