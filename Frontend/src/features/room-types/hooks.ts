"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { roomTypesApi } from "./api";
import { toast } from "@/lib/toast-store";
import { ApiError } from "@/lib/api-client";
import type { CreateRoomTypePayload, UpdateRoomTypePayload } from "./types";

const QUERY_KEY = ["room-types"];

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function useRoomTypes() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: roomTypesApi.list });
}

export function useCreateRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRoomTypePayload) => roomTypesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã tạo loại phòng khám");
    },
    onError: (err) => toast.error(errorMessage(err, "Tạo loại phòng khám thất bại")),
  });
}

export function useUpdateRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateRoomTypePayload }) =>
      roomTypesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã cập nhật loại phòng khám");
    },
    onError: (err) => toast.error(errorMessage(err, "Cập nhật thất bại")),
  });
}

export function useDeleteRoomType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => roomTypesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã xoá loại phòng khám");
    },
    onError: (err) => toast.error(errorMessage(err, "Xoá thất bại")),
  });
}
