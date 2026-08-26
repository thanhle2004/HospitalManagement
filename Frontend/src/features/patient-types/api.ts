import { apiFetch } from "@/lib/api-client";
import type { CreatePatientTypePayload, PatientType, UpdatePatientTypePayload } from "./types";

export const patientTypesApi = {
  list: () => apiFetch<PatientType[]>("/patient-types"),
  create: (payload: CreatePatientTypePayload) =>
    apiFetch<PatientType>("/patient-types", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: number, payload: UpdatePatientTypePayload) =>
    apiFetch<PatientType>(`/patient-types/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: number) => apiFetch<void>(`/patient-types/${id}`, { method: "DELETE" }),
};
