import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const FindDoctorAssignmentsQuerySchema = z.object({
  doctorId: z.string().uuid().optional(),
  roomId: z.coerce.number().int().positive().optional(),
  // true = chỉ lấy ca đang trực (endTime null hoặc endTime > hiện tại)
  activeOnly: z.coerce.boolean().optional(),
});

export class FindDoctorAssignmentsQueryDto extends createZodDto(
  FindDoctorAssignmentsQuerySchema,
) {}
