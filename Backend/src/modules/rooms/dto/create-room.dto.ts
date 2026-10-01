import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateRoomSchema = z
  .object({
    roomNumber: z.string().min(1, 'Số phòng không được để trống'),
    name: z.string().min(1, 'Tên phòng không được để trống'),
    sortOrder: z.coerce.number().int().default(0),
    roomTypeId: z.coerce.number().int().positive(),
    avgProcessTime: z.coerce
      .number()
      .int()
      .positive('Thời gian xử lý override phải > 0 (đơn vị: giây)')
      .nullable()
      .optional(),
  })
  .strict();

export class CreateRoomDto extends createZodDto(CreateRoomSchema) {}
