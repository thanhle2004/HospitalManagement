import { apiFetch } from "@/lib/api-client";
import type { StaffUser } from "@/features/auth/types";
import type { CreateDoctorPayload } from "./types";

export const doctorsApi = {
  list: () => apiFetch<StaffUser[]>("/users/doctors"),
  create: (payload: CreateDoctorPayload) =>
    apiFetch<StaffUser>("/users/doctors", { method: "POST", body: JSON.stringify(payload) }),
  lock: (id: string) => apiFetch<StaffUser>(`/users/doctors/${id}/lock`, { method: "PATCH" }),
  unlock: (id: string) => apiFetch<StaffUser>(`/users/doctors/${id}/unlock`, { method: "PATCH" }),
};
