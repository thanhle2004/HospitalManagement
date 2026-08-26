import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const FindDevicesQuerySchema = z.object({
  roomId: z.coerce.number().int().positive().optional(),
});

export class FindDevicesQueryDto extends createZodDto(FindDevicesQuerySchema) {}
