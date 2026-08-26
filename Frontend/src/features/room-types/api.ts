import { apiFetch } from "@/lib/api-client";
import type { CreateRoomTypePayload, RoomType, UpdateRoomTypePayload } from "./types";

export const roomTypesApi = {
  list: () => apiFetch<RoomType[]>("/room-types"),
  create: (payload: CreateRoomTypePayload) =>
    apiFetch<RoomType>("/room-types", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: number, payload: UpdateRoomTypePayload) =>
    apiFetch<RoomType>(`/room-types/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: number) => apiFetch<void>(`/room-types/${id}`, { method: "DELETE" }),
};
