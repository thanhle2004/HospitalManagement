"use client";

import { useQuery } from "@tanstack/react-query";
import { adminQueueApi } from "./api";

export function useAdminQueueOverview() {
  return useQuery({ queryKey: ["admin-queue"], queryFn: adminQueueApi.overview });
}
