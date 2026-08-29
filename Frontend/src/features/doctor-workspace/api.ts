import { apiFetch } from "@/lib/api-client";
import type {
  DoctorDutyAssignment,
  DoctorQueueEntry,
  ExamActionResponse,
} from "./types";

export const doctorWorkspaceApi = {
  dutyAssignments: () =>
    apiFetch<DoctorDutyAssignment[]>("/doctor/duty-assignments"),
  confirmRoom: (assignmentId: number) =>
    apiFetch<DoctorDutyAssignment>(
      `/doctor/duty-assignments/${assignmentId}/confirm-room`,
      { method: "POST" },
    ),
  queue: () => apiFetch<DoctorQueueEntry[]>("/doctor/queue"),
  startExam: (visitAssignmentId: number) =>
    apiFetch<ExamActionResponse>(
      `/doctor/visit-assignments/${visitAssignmentId}/start`,
      { method: "POST" },
    ),
  completeExam: (visitAssignmentId: number) =>
    apiFetch<ExamActionResponse>(
      `/doctor/visit-assignments/${visitAssignmentId}/complete`,
      { method: "POST" },
    ),
};
