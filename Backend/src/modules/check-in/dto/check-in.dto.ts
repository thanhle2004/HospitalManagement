import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CheckInSchema = z
  .object({
    token: z.string().min(1, 'token không được để trống'),
  })
  .strict();

export class CheckInDto extends createZodDto(CheckInSchema) {}
