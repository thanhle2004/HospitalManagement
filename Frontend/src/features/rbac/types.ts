export interface Permission {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  assignedUserCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateRolePayload {
  code: string;
  name: string;
  description?: string;
  permissionCodes: string[];
}

export interface StaffRoleSummary {
  id: string;
  email: string;
  legacyRole: StaffRoleCode;
  status: "ACTIVE" | "INACTIVE" | "LOCKED";
  fullName: string | null;
  phone: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  roles: string[];
}

export type StaffRoleCode = "ADMIN" | "DOCTOR" | "NURSE" | "RECEPTIONIST" | "LAB_TECHNICIAN" | "PHARMACIST" | "CASHIER";

export interface CreateStaffPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: StaffRoleCode;
  reason: string;
}
