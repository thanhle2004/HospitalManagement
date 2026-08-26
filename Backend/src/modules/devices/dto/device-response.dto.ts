import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { DeviceStatus, DeviceType } from '@prisma/client';

export const DeviceResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.nativeEnum(DeviceType),
  status: z.nativeEnum(DeviceStatus),
  lastHeartbeatAt: z.date().nullable(),
  appVersion: z.string().nullable(),
  room: z.object({
    id: z.number(),
    roomNumber: z.string(),
    name: z.string(),
  }),
  createdAt: z.date(),
  // Cố ý KHÔNG có secretKeyHash ở đây
});

export class DeviceResponseDto extends createZodDto(DeviceResponseSchema) {}

// Response riêng cho lúc create/regenerate — CHỈ lần này mới trả secret gốc (plaintext)
export const DeviceWithSecretResponseSchema = DeviceResponseSchema.extend({
  secret: z.string(),
});

export class DeviceWithSecretResponseDto extends createZodDto(
  DeviceWithSecretResponseSchema,
) {}
