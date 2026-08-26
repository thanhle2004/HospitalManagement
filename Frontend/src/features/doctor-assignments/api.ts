import { apiFetch } from "@/lib/api-client";
import type { CreateDoctorAssignmentPayload, DoctorAssignment } from "./types";

export interface ListDoctorAssignmentsParams {
  activeOnly?: boolean;
}

export const doctorAssignmentsApi = {
  list: (params?: ListDoctorAssignmentsParams) =>
    apiFetch<DoctorAssignment[]>(
      `/doctor-assignments${params?.activeOnly ? "?activeOnly=true" : ""}`,
    ),
  create: (payload: CreateDoctorAssignmentPayload) =>
    apiFetch<DoctorAssignment>("/doctor-assignments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  endShift: (id: number) =>
    apiFetch<DoctorAssignment>(`/doctor-assignments/${id}/end`, { method: "PATCH" }),
  remove: (id: number) => apiFetch<void>(`/doctor-assignments/${id}`, { method: "DELETE" }),
};
