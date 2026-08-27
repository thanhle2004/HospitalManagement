export interface ClinicService {
  id: number;
  code: string;
  name: string;
  description: string | null;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceStep {
  id: number;
  code: string;
  displayOrder: number;
  isOptional: boolean;
  roomType: {
    id: number;
    name: string;
  };
  dependsOn: number[];
}

export interface ClinicServiceDetail {
  id: number;
  code: string;
  name: string;
  description: string | null;
  steps: ServiceStep[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateServicePayload {
  code: string;
  name: string;
  description?: string;
}

export type UpdateServicePayload = Partial<CreateServicePayload>;

export interface CreateServiceStepPayload {
  code: string;
  roomTypeId: number;
  displayOrder: number;
  isOptional: boolean;
}

export type UpdateServiceStepPayload = Partial<CreateServiceStepPayload>;

export interface CreateServiceDependencyPayload {
  stepId: number;
  requiredStepId: number;
}
