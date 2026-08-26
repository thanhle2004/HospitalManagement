"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { devicesApi } from "./api";
import { toast } from "@/lib/toast-store";
import { ApiError } from "@/lib/api-client";
import type { CreateDevicePayload, DeviceStatus, UpdateDevicePayload } from "./types";

const QUERY_KEY = ["devices"];

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function useDevices() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: devicesApi.list });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDevicePayload) => devicesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      // Không toast ở đây — UI phải hiện dialog secret trước, xem device-secret-dialog.tsx
    },
    onError: (err) => toast.error(errorMessage(err, "Tạo thiết bị thất bại")),
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDevicePayload }) =>
      devicesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã cập nhật thiết bị");
    },
    onError: (err) => toast.error(errorMessage(err, "Cập nhật thất bại")),
  });
}

export function useUpdateDeviceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: DeviceStatus }) =>
      devicesApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã đổi trạng thái thiết bị");
    },
    onError: (err) => toast.error(errorMessage(err, "Đổi trạng thái thất bại")),
  });
}

export function useRegenerateDeviceSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => devicesApi.regenerateSecret(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      // Không toast — dialog secret tự hiển thị kết quả
    },
    onError: (err) => toast.error(errorMessage(err, "Cấp secret mới thất bại")),
  });
}
