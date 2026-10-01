import { apiFetch } from "@/lib/api-client";
import type { Gender, StaffUser } from "./types";

export interface UpdateStaffProfileRequest {
  fullName: string;
  phone?: string;
  gender?: Gender;
  birthday?: string;
  address?: string;
  description?: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export const staffProfileApi = {
  update: (payload: UpdateStaffProfileRequest) =>
    apiFetch<StaffUser>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  changePassword: (payload: ChangePasswordRequest) =>
    apiFetch<void>("/users/me/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
