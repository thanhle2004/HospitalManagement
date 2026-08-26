import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const AddAdHocStepSchema = z
  .object({
    roomTypeId: z.coerce.number().int().positive(),
    isOptional: z.boolean().default(true),
    // Danh sách VisitStep.id (đã tồn tại trong CHÍNH visit này) mà bước mới
    // phải chờ hoàn thành trước. Bỏ trống = bước mới READY ngay lập tức.
    dependsOn: z.array(z.coerce.number().int().positive()).default([]),
  })
  .strict();

export class AddAdHocStepDto extends createZodDto(AddAdHocStepSchema) {}
