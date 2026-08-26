import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateRoomSchema = z
  .object({
    roomNumber: z.string().min(1, 'Số phòng không được để trống'),
    name: z.string().min(1, 'Tên phòng không được để trống'),
    sortOrder: z.coerce.number().int().default(0),
    roomTypeId: z.coerce.number().int().positive(),
  })
  .strict();

export class CreateRoomDto extends createZodDto(CreateRoomSchema) {}
