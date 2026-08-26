import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RoomTypeResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  avgProcessTime: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export class RoomTypeResponseDto extends createZodDto(
  RoomTypeResponseSchema,
) {}
