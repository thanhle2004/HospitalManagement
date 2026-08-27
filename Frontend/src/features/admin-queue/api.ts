import { apiFetch } from "@/lib/api-client";
import type { AdminQueueEntry } from "./types";

export const adminQueueApi = {
  overview: () => apiFetch<AdminQueueEntry[]>("/admin/queue"),
  moveToFront: (queueEntryId: number) =>
    apiFetch<void>(`/admin/queue/${queueEntryId}/move-to-front`, { method: "POST" }),
  moveAfter: (queueEntryId: number, targetQueueEntryId: number) =>
    apiFetch<void>(`/admin/queue/${queueEntryId}/move-after/${targetQueueEntryId}`, {
      method: "POST",
    }),
};
