export type Gender = "MALE" | "FEMALE" | "OTHER";

export interface Patient {
  id: string;
  phone: string;
  fullName: string;
  gender: Gender | null;
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

export interface PatientFilters {
  search?: string;
  patientTypeId?: number;
  page: number;
  limit: number;
}

export interface PaginatedPatients {
  items: Patient[];
  total: number;
  page: number;
  limit: number;
}
