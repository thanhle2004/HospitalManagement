import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const FindActivityLogsQuerySchema = z.object({
  entity: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export class FindActivityLogsQueryDto extends createZodDto(FindActivityLogsQuerySchema) {}
