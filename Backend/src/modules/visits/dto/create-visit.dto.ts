import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateVisitSchema = z
  .object({
    flowId: z.coerce.number().int().positive(),
  })
  .strict();

export class CreateVisitDto extends createZodDto(CreateVisitSchema) {}
