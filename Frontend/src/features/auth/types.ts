import type { components } from "@/generated/critical-staff-contract";

type GeneratedStaffSession = components["schemas"]["StaffCurrentSessionEnvelopeDto"]["data"];

export type StaffRole = GeneratedStaffSession["role"];
export type StaffWorkspace = NonNullable<GeneratedStaffSession["workspace"]>;
export type StaffStatus = GeneratedStaffSession["status"];
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
