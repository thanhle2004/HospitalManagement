import { apiFetch } from "@/lib/api-client";

export interface StaffSession {
  id: string;
  deviceInfo: string | null;
  ipAddress: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

export const staffSessionsApi = {
  list: () => apiFetch<StaffSession[]>("/api/v1/auth/sessions/active"),
  revoke: (id: string) => apiFetch<void>(`/api/v1/auth/sessions/${id}`, { method: "DELETE" }),
  revokeOthers: () => apiFetch<void>("/api/v1/auth/sessions/others", { method: "DELETE" }),
};
