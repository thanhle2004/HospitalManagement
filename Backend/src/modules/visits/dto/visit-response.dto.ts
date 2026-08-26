import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { VisitStatus } from '@prisma/client';

export const VisitResponseSchema = z.object({
  id: z.string(),
  status: z.nativeEnum(VisitStatus),
  flow: z.object({ id: z.number(), code: z.string(), name: z.string() }),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
});

export class VisitResponseDto extends createZodDto(VisitResponseSchema) {}
