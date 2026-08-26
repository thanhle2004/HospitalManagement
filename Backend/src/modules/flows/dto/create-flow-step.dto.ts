import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateFlowStepSchema = z
  .object({
    code: z.string().min(1, 'Code không được để trống (vd: XRAY_1, LAB)'),
    roomTypeId: z.coerce.number().int().positive(),
    displayOrder: z.coerce.number().int(),
    isOptional: z.boolean().default(false),
  })
  .strict();

export class CreateFlowStepDto extends createZodDto(CreateFlowStepSchema) {}
