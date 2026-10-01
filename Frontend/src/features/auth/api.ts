import { envelopeFetch } from "@/lib/api-client";
import type { LoginRequest, StaffSessionUser } from "./types";

export const authApi = {
  login: (payload: LoginRequest) =>
    envelopeFetch<StaffSessionUser>("/api/session", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: () => envelopeFetch<void>("/api/session", { method: "DELETE" }),

  getSession: () => envelopeFetch<StaffSessionUser>("/api/session"),
};
