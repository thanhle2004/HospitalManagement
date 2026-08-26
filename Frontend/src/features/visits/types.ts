export type VisitStatus = "CREATED" | "WAITING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface VisitSummary {
  id: string;
  status: VisitStatus;
  flow: { id: number; code: string; name: string };
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
