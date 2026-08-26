import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateRoomTypeSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    avgProcessTime: z.coerce.number().int().positive().optional(),
  })
  .strict();

export class UpdateRoomTypeDto extends createZodDto(UpdateRoomTypeSchema) {}
