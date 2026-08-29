import type { DoctorAssignment } from "@/features/doctor-assignments/types";

export type AssignmentStatus =
  | "WAITING"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type DoctorDutyAssignment = DoctorAssignment;

export interface DoctorQueueEntry {
  queueEntryId: number;
  position: number;
  visitAssignmentId: number;
  visitStepId: number;
  status: AssignmentStatus;
  room: { id: number; roomNumber: string; name: string };
  roomType: { id: number; name: string };
  patient: { id: string; fullName: string; phone: string };
  checkedInAt: string | null;
}

export interface ExamActionResponse {
  visitAssignmentId: number;
  status: AssignmentStatus;
}
