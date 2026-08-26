import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { AssignmentStatus } from '@prisma/client';

export const ExamActionResponseSchema = z.object({
  visitAssignmentId: z.number(),
  status: z.nativeEnum(AssignmentStatus),
});

export class ExamActionResponseDto extends createZodDto(ExamActionResponseSchema) {}
