import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { VisitStatus, VisitStepStatus } from '@prisma/client';

export const VisitStepNodeSchema = z.object({
  id: z.number(),
  code: z.string().nullable(), // null nếu là bước ad-hoc (isAdHoc=true, Phase 8)
  status: z.nativeEnum(VisitStepStatus),
  isOptional: z.boolean(),
  isAdHoc: z.boolean(),
  displayOrder: z.number(),
  roomType: z.object({ id: z.number(), name: z.string() }),
  // Danh sách requiredStepId (VisitStep.id) — cạnh của đồ thị DAG runtime
  dependsOn: z.array(z.number()),
  completedAt: z.date().nullable(),
  // null nếu Routing Engine chưa xử lý xong (step còn LOCKED/READY)
  assignment: z
    .object({
      room: z.object({ id: z.number(), roomNumber: z.string(), name: z.string() }),
      qrToken: z.string().nullable(),
      qrExpiresAt: z.date().nullable(),
    })
    .nullable(),
});

export const VisitDetailResponseSchema = z.object({
  id: z.string(),
  status: z.nativeEnum(VisitStatus),
  flow: z.object({ id: z.number(), code: z.string(), name: z.string() }),
  patientId: z.string(),
  steps: z.array(VisitStepNodeSchema),
  createdAt: z.date(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  cancelledAt: z.date().nullable(),
});

export class VisitDetailResponseDto extends createZodDto(
  VisitDetailResponseSchema,
) {}
