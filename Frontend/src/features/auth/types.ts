export type StaffRole =
  | "ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "RECEPTIONIST"
  | "LAB_TECHNICIAN"
  | "PHARMACIST"
  | "CASHIER";
export type StaffWorkspace = "ADMIN" | "DOCTOR";
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

export interface StaffSessionUser extends StaffUser {
  effectiveRoles: string[];
  effectivePermissions: string[];
  workspace: StaffWorkspace | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}
