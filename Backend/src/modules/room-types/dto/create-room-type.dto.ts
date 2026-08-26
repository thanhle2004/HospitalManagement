import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateRoomTypeSchema = z
  .object({
    name: z.string().min(1, 'Tên không được để trống'),
    description: z.string().optional(),
    avgProcessTime: z.coerce
      .number()
      .int()
      .positive('Thời gian xử lý trung bình phải > 0 (đơn vị: phút)'),
  })
  .strict();

export class CreateRoomTypeDto extends createZodDto(CreateRoomTypeSchema) {}
