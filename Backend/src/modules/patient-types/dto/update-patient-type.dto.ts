import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdatePatientTypeSchema = z
  .object({
    code: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
  })
  .strict();

export class UpdatePatientTypeDto extends createZodDto(UpdatePatientTypeSchema) {}
