import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateRoomSchema = z
  .object({
    roomNumber: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    sortOrder: z.coerce.number().int().optional(),
    roomTypeId: z.coerce.number().int().positive().optional(),
    avgProcessTime: z.coerce
      .number()
      .int()
      .positive('Thời gian xử lý override phải > 0 (đơn vị: giây)')
      .nullable()
      .optional(),
  })
  .strict();

export class UpdateRoomDto extends createZodDto(UpdateRoomSchema) {}
