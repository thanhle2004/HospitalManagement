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
  purpose: "LOGIN" | "REGISTER";
}

export interface VerifyLoginRequest {
  action: "VERIFY_LOGIN";
  phone: string;
  otp: string;
}

export interface VerifyRegisterRequest {
  action: "VERIFY_REGISTER";
  phone: string;
  otp: string;
  fullName: string;
  gender?: PatientGender;
  birthday?: string;
  email?: string;
  address?: string;
  identityNumber?: string;
  emergencyContact?: string;
}
