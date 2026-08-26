import { apiFetch } from "@/lib/api-client";
import type { AdminQueueEntry } from "./types";

export const adminQueueApi = {
  overview: () => apiFetch<AdminQueueEntry[]>("/admin/queue"),
};
