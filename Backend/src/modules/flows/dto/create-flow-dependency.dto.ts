import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateFlowDependencySchema = z
  .object({
    stepId: z.coerce.number().int().positive(),
    requiredStepId: z.coerce.number().int().positive(),
  })
  .strict()
  .refine((data) => data.stepId !== data.requiredStepId, {
    message: 'stepId và requiredStepId không được trùng nhau (self-dependency)',
    path: ['requiredStepId'],
  });

export class CreateFlowDependencyDto extends createZodDto(
  CreateFlowDependencySchema,
) {}
