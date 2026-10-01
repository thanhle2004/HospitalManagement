import { apiFetch } from "@/lib/api-client";
import type { CreateRolePayload, CreateStaffPayload, Paginated, Permission, Role, StaffRoleSummary } from "./types";

export const rbacApi = {
  listRoles: () => apiFetch<Paginated<Role>>("/api/v1/roles?page=1&limit=100"),
  listPermissions: () => apiFetch<Paginated<Permission>>("/api/v1/permissions?page=1&limit=100"),
  listStaff: () => apiFetch<Paginated<StaffRoleSummary>>("/api/v1/staff?page=1&limit=100"),
  createRole: (payload: CreateRolePayload) =>
    apiFetch<Role>("/api/v1/roles", { method: "POST", body: JSON.stringify(payload) }),
  assignRole: (userId: string, roleCode: string, reason: string) =>
    apiFetch<void>(`/api/v1/staff/${userId}/roles`, { method: "POST", body: JSON.stringify({ roleCode, reason }) }),
  revokeRole: (userId: string, roleCode: string, reason: string) =>
    apiFetch<void>(`/api/v1/staff/${userId}/roles/${encodeURIComponent(roleCode)}`, { method: "DELETE", body: JSON.stringify({ reason }) }),
  createStaff: (payload: CreateStaffPayload) =>
    apiFetch("/api/v1/staff", { method: "POST", body: JSON.stringify(payload) }),
  updateStaffStatus: (userId: string, status: "ACTIVE" | "INACTIVE" | "LOCKED", reason: string) =>
    apiFetch(`/api/v1/staff/${userId}/status`, { method: "PATCH", body: JSON.stringify({ status, reason }) }),
};
