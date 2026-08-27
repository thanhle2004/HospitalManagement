import { envelopeFetch } from "@/lib/api-client";
import type { LoginRequest, StaffUser } from "./types";

export const authApi = {
  login: (payload: LoginRequest) =>
    envelopeFetch<StaffUser>("/api/session", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: () => envelopeFetch<void>("/api/session", { method: "DELETE" }),

  getSession: () => envelopeFetch<StaffUser>("/api/session"),
};
