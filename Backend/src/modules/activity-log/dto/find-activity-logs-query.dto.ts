import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const FindActivityLogsQuerySchema = z.object({
  action: z.string().max(80).optional(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
}).strict().refine(({ from, to }) => !from || !to || from <= to, {
  message: 'from phải nhỏ hơn hoặc bằng to',
  path: ['to'],
});

export class FindActivityLogsQueryDto extends createZodDto(FindActivityLogsQuerySchema) {}
