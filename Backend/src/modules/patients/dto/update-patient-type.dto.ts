import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const UpdatePatientTypeSchema = z
  .object({
    patientTypeId: z.coerce.number().int().positive(),
  })
  .strict();

export class UpdatePatientTypeDto extends createZodDto(
  UpdatePatientTypeSchema,
) {}
