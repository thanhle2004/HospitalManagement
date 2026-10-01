import { apiFetch } from "@/lib/api-client";
import type { ActivityLogFilters, PaginatedActivityLogs } from "./types";

function toQueryString(filters: ActivityLogFilters) {
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit),
  });
  if (filters.entity) params.set("entity", filters.entity);
  if (filters.entityId) params.set("entityId", filters.entityId);
  if (filters.userId) params.set("userId", filters.userId);
  if (filters.action) params.set("action", filters.action);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params.toString();
}

export const activityLogApi = {
  list: (filters: ActivityLogFilters) =>
    apiFetch<PaginatedActivityLogs>(`/activity-logs?${toQueryString(filters)}`),
  recent: (limit = 5) =>
    apiFetch<PaginatedActivityLogs>(`/activity-logs?limit=${limit}&page=1`),
};
