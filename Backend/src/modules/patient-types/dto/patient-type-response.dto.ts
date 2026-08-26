import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const PatientTypeResponseSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});

export class PatientTypeResponseDto extends createZodDto(PatientTypeResponseSchema) {}
