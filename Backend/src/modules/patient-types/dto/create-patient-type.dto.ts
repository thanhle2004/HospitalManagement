import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreatePatientTypeSchema = z
  .object({
    code: z.string().min(1, 'Code không được để trống'),
    name: z.string().min(1, 'Tên không được để trống'),
    description: z.string().optional(),
  })
  .strict();

export class CreatePatientTypeDto extends createZodDto(CreatePatientTypeSchema) {}
