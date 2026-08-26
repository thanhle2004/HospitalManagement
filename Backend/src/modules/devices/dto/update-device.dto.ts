import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateDeviceSchema = z
  .object({
    name: z.string().min(1).optional(),
    roomId: z.coerce.number().int().positive().optional(),
    appVersion: z.string().optional(),
  })
  .strict();

export class UpdateDeviceDto extends createZodDto(UpdateDeviceSchema) {}
