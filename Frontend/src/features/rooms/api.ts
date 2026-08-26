import { apiFetch } from "@/lib/api-client";
import type { CreateRoomPayload, Room, RoomStatus, UpdateRoomPayload } from "./types";

export const roomsApi = {
  list: () => apiFetch<Room[]>("/rooms"),
  create: (payload: CreateRoomPayload) =>
    apiFetch<Room>("/rooms", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: number, payload: UpdateRoomPayload) =>
    apiFetch<Room>(`/rooms/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  updateStatus: (id: number, status: RoomStatus) =>
    apiFetch<Room>(`/rooms/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
};
