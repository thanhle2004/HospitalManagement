import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { RoomStatus } from '@prisma/client';

export const UpdateRoomStatusSchema = z
  .object({
    status: z.nativeEnum(RoomStatus),
  })
  .strict();

export class UpdateRoomStatusDto extends createZodDto(UpdateRoomStatusSchema) {}
