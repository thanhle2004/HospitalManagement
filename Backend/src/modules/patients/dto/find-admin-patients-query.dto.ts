import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const FindAdminPatientsQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  patientTypeId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export class FindAdminPatientsQueryDto extends createZodDto(
  FindAdminPatientsQuerySchema,
) {}
