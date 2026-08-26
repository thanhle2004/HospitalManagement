import { apiFetch } from "@/lib/api-client";
import type {
  CreateDevicePayload,
  Device,
  DeviceStatus,
  DeviceWithSecret,
  UpdateDevicePayload,
} from "./types";

export const devicesApi = {
  list: () => apiFetch<Device[]>("/devices"),
  create: (payload: CreateDevicePayload) =>
    apiFetch<DeviceWithSecret>("/devices", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, payload: UpdateDevicePayload) =>
    apiFetch<Device>(`/devices/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  updateStatus: (id: string, status: DeviceStatus) =>
    apiFetch<Device>(`/devices/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  regenerateSecret: (id: string) =>
    apiFetch<DeviceWithSecret>(`/devices/${id}/regenerate-secret`, { method: "POST" }),
};
