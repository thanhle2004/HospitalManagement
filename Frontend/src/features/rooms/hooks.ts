"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roomsApi } from "./api";
import { toast } from "@/lib/toast-store";
import { ApiError } from "@/lib/api-client";
import type { CreateRoomPayload, RoomStatus, UpdateRoomPayload } from "./types";

const QUERY_KEY = ["rooms"];

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function useRooms() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: roomsApi.list });
}

export function useCreateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRoomPayload) => roomsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã tạo phòng khám");
    },
    onError: (err) => toast.error(errorMessage(err, "Tạo phòng khám thất bại")),
  });
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateRoomPayload }) =>
      roomsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã cập nhật phòng khám");
    },
    onError: (err) => toast.error(errorMessage(err, "Cập nhật thất bại")),
  });
}

export function useUpdateRoomStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: RoomStatus }) =>
      roomsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã đổi trạng thái phòng");
    },
    onError: (err) => toast.error(errorMessage(err, "Đổi trạng thái thất bại")),
  });
}
