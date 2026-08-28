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

export interface VerifyFirebasePhoneRequest {
  action: "VERIFY_FIREBASE_PHONE";
  firebaseIdToken: string;
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

export type VerifyFirebasePhoneResult =
  | PatientProfile
  | { requiresRegistration: true; registrationToken: string };
