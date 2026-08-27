import { apiFetch } from "@/lib/api-client";
import type {
  ClinicService,
  ClinicServiceDetail,
  CreateServiceDependencyPayload,
  CreateServicePayload,
  CreateServiceStepPayload,
  ServiceStep,
  UpdateServicePayload,
  UpdateServiceStepPayload,
} from "./types";

export const servicesApi = {
  list: () => apiFetch<ClinicService[]>("/flows"),
  detail: (id: number) => apiFetch<ClinicServiceDetail>(`/flows/${id}`),
  create: (payload: CreateServicePayload) =>
    apiFetch<ClinicService>("/flows", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: number, payload: UpdateServicePayload) =>
    apiFetch<ClinicService>(`/flows/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  remove: (id: number) => apiFetch<void>(`/flows/${id}`, { method: "DELETE" }),
  createStep: (serviceId: number, payload: CreateServiceStepPayload) =>
    apiFetch<ServiceStep>(`/flows/${serviceId}/steps`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateStep: (serviceId: number, stepId: number, payload: UpdateServiceStepPayload) =>
    apiFetch<ServiceStep>(`/flows/${serviceId}/steps/${stepId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  removeStep: (serviceId: number, stepId: number) =>
    apiFetch<void>(`/flows/${serviceId}/steps/${stepId}`, { method: "DELETE" }),
  createDependency: (serviceId: number, payload: CreateServiceDependencyPayload) =>
    apiFetch<void>(`/flows/${serviceId}/dependencies`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  removeDependency: (serviceId: number, stepId: number, requiredStepId: number) =>
    apiFetch<void>(`/flows/${serviceId}/dependencies/${stepId}/${requiredStepId}`, {
      method: "DELETE",
    }),
};
