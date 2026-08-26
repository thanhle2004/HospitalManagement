export type StaffRole = "ADMIN" | "DOCTOR";
export type StaffStatus = "ACTIVE" | "INACTIVE" | "LOCKED";
export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface StaffProfile {
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  gender: Gender | null;
  birthday: string | null;
  address: string | null;
  description: string | null;
}

export interface StaffUser {
  id: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  lastLoginAt: string | null;
  createdAt: string;
  profile: StaffProfile | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}
