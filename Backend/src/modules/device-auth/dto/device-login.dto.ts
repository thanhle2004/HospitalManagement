import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const DeviceLoginSchema = z
  .object({
    code: z.string().min(1, 'Code không được để trống'),
    secret: z.string().min(1, 'Secret không được để trống'),
  })
  .strict();

export class DeviceLoginDto extends createZodDto(DeviceLoginSchema) {}
