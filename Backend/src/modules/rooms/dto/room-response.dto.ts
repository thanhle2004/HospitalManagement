import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { RoomStatus } from '@prisma/client';

export const RoomResponseSchema = z.object({
  id: z.number(),
  roomNumber: z.string(),
  name: z.string(),
  sortOrder: z.number(),
  status: z.nativeEnum(RoomStatus),
  roomType: z.object({
    id: z.number(),
    name: z.string(),
  }),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export class RoomResponseDto extends createZodDto(RoomResponseSchema) {}
