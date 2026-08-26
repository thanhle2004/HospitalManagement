import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateRoomSchema = z
  .object({
    roomNumber: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    sortOrder: z.coerce.number().int().optional(),
    roomTypeId: z.coerce.number().int().positive().optional(),
  })
  .strict();

export class UpdateRoomDto extends createZodDto(UpdateRoomSchema) {}
