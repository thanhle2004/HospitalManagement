import { patientRequest } from "@/features/patient-auth/api";
import type {
  PatientService,
  PatientServiceDetail,
  PatientVisit,
  PatientVisitDetail,
} from "./types";

const portalFetch = <T>(path: string, options: RequestInit = {}) =>
  patientRequest<T>(`/api/patient/backend${path}`, options);

export const patientPortalApi = {
  services: () => portalFetch<PatientService[]>("/patient/flows"),
  serviceDetail: (id: number) =>
    portalFetch<PatientServiceDetail>(`/patient/flows/${id}`),
  visits: () => portalFetch<PatientVisit[]>("/visits/me"),
  visitDetail: (id: string) => portalFetch<PatientVisitDetail>(`/visits/me/${id}`),
  createVisit: (flowId: number) =>
    portalFetch<PatientVisitDetail>("/visits", {
      method: "POST",
      body: JSON.stringify({ flowId }),
    }),
};
