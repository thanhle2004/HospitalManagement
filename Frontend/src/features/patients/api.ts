import { apiFetch } from "@/lib/api-client";
import type { PaginatedPatients, Patient, PatientFilters } from "./types";

function toQueryString(filters: PatientFilters) {
  const params = new URLSearchParams({
    page: String(filters.page),
    limit: String(filters.limit),
  });
  if (filters.search) params.set("search", filters.search);
  if (filters.patientTypeId) params.set("patientTypeId", String(filters.patientTypeId));
  return params.toString();
}

export const patientsApi = {
  list: (filters: PatientFilters) =>
    apiFetch<PaginatedPatients>(`/admin/patients?${toQueryString(filters)}`),
  detail: (id: string) => apiFetch<Patient>(`/admin/patients/${id}`),
  updatePatientType: (id: string, patientTypeId: number) =>
    apiFetch<Patient>(`/admin/patients/${id}/patient-type`, {
      method: "PATCH",
      body: JSON.stringify({ patientTypeId }),
    }),
};
