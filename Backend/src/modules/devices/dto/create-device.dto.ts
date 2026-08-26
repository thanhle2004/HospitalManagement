import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { DeviceType } from '@prisma/client';

export const CreateDeviceSchema = z
  .object({
    code: z.string().min(1, 'Code không được để trống'),
    name: z.string().min(1, 'Tên thiết bị không được để trống'),
    roomId: z.coerce.number().int().positive(),
    type: z.nativeEnum(DeviceType).default(DeviceType.QR_SCANNER),
  })
  .strict();

export class CreateDeviceDto extends createZodDto(CreateDeviceSchema) {}
