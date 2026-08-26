import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const DoctorQueueEntrySchema = z.object({
  queueEntryId: z.number(),
  position: z.number(),
  visitAssignmentId: z.number(),
  visitStepId: z.number(),
  room: z.object({ id: z.number(), roomNumber: z.string(), name: z.string() }),
  roomType: z.object({ id: z.number(), name: z.string() }),
  patient: z.object({ id: z.string(), fullName: z.string(), phone: z.string() }),
  checkedInAt: z.date().nullable(),
});

export class DoctorQueueEntryDto extends createZodDto(DoctorQueueEntrySchema) {}
