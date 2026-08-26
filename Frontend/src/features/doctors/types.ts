export type { StaffUser, Gender } from "@/features/auth/types";

export interface CreateDoctorPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  birthday?: string;
  address?: string;
}
