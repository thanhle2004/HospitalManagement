export interface PatientType {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

export interface CreatePatientTypePayload {
  code: string;
  name: string;
  description?: string;
}

export type UpdatePatientTypePayload = Partial<CreatePatientTypePayload>;
