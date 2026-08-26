import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { VisitStepStatus } from '@prisma/client';

export const CheckInResponseSchema = z.object({
  visitStepId: z.number(),
  status: z.nativeEnum(VisitStepStatus),
  roomId: z.number(),
  queuePosition: z.number(),
});

export class CheckInResponseDto extends createZodDto(CheckInResponseSchema) {}
