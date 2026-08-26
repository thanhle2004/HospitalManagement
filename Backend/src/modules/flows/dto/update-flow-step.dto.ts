import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdateFlowStepSchema = z
  .object({
    code: z.string().min(1).optional(),
    roomTypeId: z.coerce.number().int().positive().optional(),
    displayOrder: z.coerce.number().int().optional(),
    isOptional: z.boolean().optional(),
  })
  .strict();

export class UpdateFlowStepDto extends createZodDto(UpdateFlowStepSchema) {}
