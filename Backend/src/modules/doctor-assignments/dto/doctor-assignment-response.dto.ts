import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const DoctorAssignmentResponseSchema = z.object({
  id: z.number(),
  startTime: z.date(),
  endTime: z.date().nullable(),
  roomConfirmedAt: z.date().nullable(),
  doctor: z.object({
    id: z.string(),
    email: z.string(),
    fullName: z.string().nullable(),
  }),
  room: z.object({
    id: z.number(),
    roomNumber: z.string(),
    name: z.string(),
  }),
});

export class DoctorAssignmentResponseDto extends createZodDto(
  DoctorAssignmentResponseSchema,
) {}
