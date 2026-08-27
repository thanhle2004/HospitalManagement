"use client";

import { useQuery } from "@tanstack/react-query";
import { activityLogApi } from "./api";
import type { ActivityLogFilters } from "./types";

export function useActivityLogs(filters: ActivityLogFilters) {
  return useQuery({
    queryKey: ["activity-logs", "list", filters],
    queryFn: () => activityLogApi.list(filters),
    placeholderData: (previous) => previous,
  });
}

export function useRecentActivityLogs(limit = 5) {
  return useQuery({
    queryKey: ["activity-logs", "recent", limit],
    queryFn: () => activityLogApi.recent(limit),
  });
}
