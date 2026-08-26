import { apiFetch } from "@/lib/api-client";
import type { PaginatedActivityLogs } from "./types";

export const activityLogApi = {
  recent: (limit = 5) =>
    apiFetch<PaginatedActivityLogs>(`/activity-logs?limit=${limit}&page=1`),
};
