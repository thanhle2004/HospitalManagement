"use client";

import { useQuery } from "@tanstack/react-query";
import { activityLogApi } from "./api";

export function useRecentActivityLogs(limit = 5) {
  return useQuery({
    queryKey: ["activity-logs", "recent", limit],
    queryFn: () => activityLogApi.recent(limit),
  });
}
