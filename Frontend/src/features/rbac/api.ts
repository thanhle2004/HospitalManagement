import { apiFetch } from "@/lib/api-client";
import type { CreateRolePayload, Paginated, Permission, Role } from "./types";

export const rbacApi = {
  listRoles: () => apiFetch<Paginated<Role>>("/api/v1/roles?page=1&limit=100"),
  listPermissions: () => apiFetch<Paginated<Permission>>("/api/v1/permissions?page=1&limit=100"),
  createRole: (payload: CreateRolePayload) =>
    apiFetch<Role>("/api/v1/roles", { method: "POST", body: JSON.stringify(payload) }),
};
