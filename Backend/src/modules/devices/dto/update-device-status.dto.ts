import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { DeviceStatus } from '@prisma/client';

export const UpdateDeviceStatusSchema = z
  .object({
    status: z.nativeEnum(DeviceStatus),
  })
  .strict();

export class UpdateDeviceStatusDto extends createZodDto(UpdateDeviceStatusSchema) {}
