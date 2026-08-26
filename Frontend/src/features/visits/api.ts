import { apiFetch } from "@/lib/api-client";
import type { VisitSummary } from "./types";

export const visitsApi = {
  /** [Staff] Toàn bộ Visit trong hệ thống — dùng cho giám sát/dashboard */
  listAll: () => apiFetch<VisitSummary[]>("/visits"),
};
