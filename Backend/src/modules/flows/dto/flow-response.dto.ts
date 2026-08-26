import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const FlowResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  stepCount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export class FlowResponseDto extends createZodDto(FlowResponseSchema) {}
