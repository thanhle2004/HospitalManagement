import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateFlowSchema = z
  .object({
    code: z.string().min(1, 'Code không được để trống'),
    name: z.string().min(1, 'Tên workflow không được để trống'),
    description: z.string().optional(),
  })
  .strict();

export class CreateFlowDto extends createZodDto(CreateFlowSchema) {}
