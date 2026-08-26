import { z } from "zod";
import { createZodDto } from "nestjs-zod";
import { AssignmentStatus, QueueEntrySource } from "@prisma/client";

export const AdminQueueEntrySchema = z.object({
  queueEntryId: z.number(),
  position: z.number(),
  source: z.nativeEnum(QueueEntrySource),
  visitAssignmentId: z.number(),
  visitStepId: z.number(),
  // [SỬA] Thêm status của VisitAssignment — trước đây FE nhận entry này
  // không phân biệt được "đang chờ" (WAITING/CHECKED_IN) với "đang được
  // khám" (IN_PROGRESS), vì RoomQueueEntry chỉ bị dequeue lúc HOÀN THÀNH
  // khám (DoctorService.completeExam), không phải lúc BẮT ĐẦU khám.
  status: z.nativeEnum(AssignmentStatus),
  room: z.object({ id: z.number(), roomNumber: z.string(), name: z.string() }),
  roomType: z.object({ id: z.number(), name: z.string() }),
  patient: z.object({ id: z.string(), fullName: z.string(), phone: z.string() }),
  checkedInAt: z.date().nullable(),
});

export class AdminQueueEntryDto extends createZodDto(AdminQueueEntrySchema) {}
