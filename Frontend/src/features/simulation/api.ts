import { apiFetch } from "@/lib/api-client";
import type {
  CompareRunsResult,
  CreateSimulationRunPayload,
  SimulationRunDetail,
  SimulationRunRecord,
  SimulationSpeed,
  SimulationViolation,
} from "./types";

export const simulationApi = {
  list: () => apiFetch<SimulationRunRecord[]>("/admin/simulation/runs"),
  detail: (id: string) => apiFetch<SimulationRunDetail>(`/admin/simulation/runs/${id}`),
  violations: (id: string) =>
    apiFetch<SimulationViolation[]>(`/admin/simulation/runs/${id}/violations`),
  create: (payload: CreateSimulationRunPayload) =>
    apiFetch<{ id: string }>("/admin/simulation/runs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  compare: (payload: Omit<CreateSimulationRunPayload, "mode">) =>
    apiFetch<CompareRunsResult>("/admin/simulation/runs/compare", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  start: (id: string) =>
    apiFetch<{ accepted: true }>(`/admin/simulation/runs/${id}/start`, { method: "POST" }),
  stop: (id: string) =>
    apiFetch<void>(`/admin/simulation/runs/${id}/stop`, { method: "POST" }),
  pause: (id: string) =>
    apiFetch<void>(`/admin/simulation/runs/${id}/pause`, { method: "POST" }),
  resume: (id: string) =>
    apiFetch<void>(`/admin/simulation/runs/${id}/resume`, { method: "POST" }),
  step: (id: string) =>
    apiFetch<void>(`/admin/simulation/runs/${id}/step`, { method: "POST" }),
  setSpeed: (id: string, speed: SimulationSpeed) =>
    apiFetch<void>(`/admin/simulation/runs/${id}/speed`, {
      method: "PATCH",
      body: JSON.stringify({ speed }),
    }),
  remove: (id: string) =>
    apiFetch<void>(`/admin/simulation/runs/${id}`, { method: "DELETE" }),
};