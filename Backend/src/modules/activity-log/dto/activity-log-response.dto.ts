import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const ActivityLogResponseSchema = z.object({
  // ActivityLog.id là BigInt trong DB — convert sang string vì BigInt không tự serialize JSON được
  id: z.string(),
  userId: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  metadata: z.any().nullable(),
  createdAt: z.date(),
});

export class ActivityLogResponseDto extends createZodDto(ActivityLogResponseSchema) {}

export const PaginatedActivityLogResponseSchema = z.object({
  items: z.array(ActivityLogResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export class PaginatedActivityLogResponseDto extends createZodDto(
  PaginatedActivityLogResponseSchema,
) {}
