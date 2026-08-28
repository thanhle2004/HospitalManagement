export type PatientGender = "MALE" | "FEMALE" | "OTHER";

export interface PatientProfile {
  id: string;
  phone: string;
  fullName: string;
  gender: PatientGender | null;
  birthday: string | null;
  email: string | null;
  address: string | null;
  identityNumber: string | null;
  emergencyContact: string | null;
  patientType: {
    id: number;
    code: string;
    name: string;
  };
  createdAt: string;
}

export interface OtpChallengeRequest {
  phone: string;
}

export interface VerifyPhoneRequest {
  action: "VERIFY_PHONE";
  phone: string;
  otp: string;
}

export interface CompleteRegistrationRequest {
  action: "COMPLETE_REGISTRATION";
  registrationToken: string;
  fullName: string;
  gender?: PatientGender;
  birthday?: string;
  email?: string;
  address?: string;
  identityNumber?: string;
  emergencyContact?: string;
}

export type VerifyPhoneResult =
  | PatientProfile
  | { requiresRegistration: true; registrationToken: string };
