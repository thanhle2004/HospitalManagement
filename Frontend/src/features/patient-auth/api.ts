import { ApiError, envelopeFetch } from "@/lib/api-client";
import { usePatientAuthStore } from "./store";
import type {
  PatientProfile,
  CompleteRegistrationRequest,
  VerifyFirebasePhoneRequest,
  VerifyFirebasePhoneResult,
} from "./types";

export async function patientRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  try {
    return await envelopeFetch<T>(url, options);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 401) {
      usePatientAuthStore.getState().clearPatient();
    }
    throw error;
  }
}

export const patientAuthApi = {
  verifyFirebasePhone: (payload: VerifyFirebasePhoneRequest) =>
    patientRequest<VerifyFirebasePhoneResult>("/api/patient/session", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  completeRegistration: (payload: CompleteRegistrationRequest) =>
    patientRequest<PatientProfile>("/api/patient/session", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getSession: () => patientRequest<PatientProfile>("/api/patient/session"),

  logout: () =>
    patientRequest<void>("/api/patient/session", { method: "DELETE" }),
};
