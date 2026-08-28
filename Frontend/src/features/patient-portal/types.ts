import type { ClinicService, ClinicServiceDetail } from "@/features/services/types";

export type PatientService = ClinicService;
export type PatientServiceDetail = ClinicServiceDetail;

export type VisitStatus =
  | "CREATED"
  | "WAITING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type VisitStepStatus =
  | "LOCKED"
  | "READY"
  | "ASSIGNED"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "SKIPPED"
  | "CANCELLED";

export interface PatientVisit {
  id: string;
  status: VisitStatus;
  flow: { id: number; code: string; name: string };
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PatientVisitStep {
  id: number;
  code: string | null;
  status: VisitStepStatus;
  isOptional: boolean;
  isAdHoc: boolean;
  displayOrder: number;
  roomType: { id: number; name: string };
  dependsOn: number[];
  completedAt: string | null;
  assignment: {
    room: { id: number; roomNumber: string; name: string };
    qrToken: string | null;
    qrExpiresAt: string | null;
  } | null;
}

export interface PatientVisitDetail extends PatientVisit {
  patientId: string;
  steps: PatientVisitStep[];
  cancelledAt: string | null;
}
