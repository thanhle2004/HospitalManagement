export type QueueEntrySource = "AUTO_CHECKIN" | "MANUAL_ADMIN";
export type AssignmentStatus = "WAITING" | "CHECKED_IN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface AdminQueueEntry {
  queueEntryId: number;
  position: number;
  source: QueueEntrySource;
  /** [MỚI] khớp field vừa thêm ở backend AdminQueueEntryDto — tách "đang chờ" khỏi "đang được khám" */
  status: AssignmentStatus;
  visitAssignmentId: number;
  visitStepId: number;
  room: { id: number; roomNumber: string; name: string };
  roomType: { id: number; name: string };
  patient: { id: string; fullName: string; phone: string };
  checkedInAt: string | null;
}
