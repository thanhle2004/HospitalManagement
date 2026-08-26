import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { RoomStatus } from '@prisma/client';

export const FindRoomsQuerySchema = z.object({
  roomTypeId: z.coerce.number().int().positive().optional(),
  status: z.nativeEnum(RoomStatus).optional(),
});

export class FindRoomsQueryDto extends createZodDto(FindRoomsQuerySchema) {}
