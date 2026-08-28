import { ApiError, envelopeFetch } from "@/lib/api-client";
import { usePatientAuthStore } from "./store";
import type {
  OtpChallengeRequest,
  PatientProfile,
  VerifyLoginRequest,
  VerifyRegisterRequest,
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
  requestOtp: (payload: OtpChallengeRequest) =>
    patientRequest<{ message: string }>(
      "/api/patient/backend/api/v1/patient-auth/otp-challenges",
      { method: "POST", body: JSON.stringify(payload) },
    ),

  verifyLogin: (payload: VerifyLoginRequest) =>
    patientRequest<PatientProfile>("/api/patient/session", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  verifyRegister: (payload: VerifyRegisterRequest) =>
    patientRequest<PatientProfile>("/api/patient/session", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getSession: () => patientRequest<PatientProfile>("/api/patient/session"),

  logout: () =>
    patientRequest<void>("/api/patient/session", { method: "DELETE" }),
};
