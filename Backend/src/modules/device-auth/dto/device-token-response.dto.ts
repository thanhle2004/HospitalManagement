import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const DeviceTokenResponseSchema = z.object({
  accessToken: z.string(),
});

export class DeviceTokenResponseDto extends createZodDto(DeviceTokenResponseSchema) {}
