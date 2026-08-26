import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateDoctorAssignmentSchema = z
  .object({
    doctorId: z.string().uuid('doctorId phải là uuid hợp lệ'),
    roomId: z.coerce.number().int().positive(),
    startTime: z.coerce.date(),
    // Không truyền = ca trực mở (chưa xác định giờ kết thúc)
    endTime: z.coerce.date().optional(),
  })
  .strict()
  .refine((data) => !data.endTime || data.endTime > data.startTime, {
    message: 'endTime phải sau startTime',
    path: ['endTime'],
  });

export class CreateDoctorAssignmentDto extends createZodDto(
  CreateDoctorAssignmentSchema,
) {}
