import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { PatientResponseSchema } from './patient-response.dto';

export const PaginatedPatientResponseSchema = z.object({
  items: z.array(PatientResponseSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

export class PaginatedPatientResponseDto extends createZodDto(
  PaginatedPatientResponseSchema,
) {}
