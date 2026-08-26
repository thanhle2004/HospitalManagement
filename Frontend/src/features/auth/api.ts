import { apiFetch } from "@/lib/api-client";
import type { LoginRequest, StaffUser, TokenResponse } from "./types";

export const authApi = {
  login: (payload: LoginRequest) =>
    apiFetch<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),

  getMe: () => apiFetch<StaffUser>("/users/me"),
};
