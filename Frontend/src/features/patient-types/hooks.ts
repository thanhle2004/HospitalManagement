"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patientTypesApi } from "./api";
import { toast } from "@/lib/toast-store";
import { ApiError } from "@/lib/api-client";
import type { CreatePatientTypePayload, UpdatePatientTypePayload } from "./types";

const QUERY_KEY = ["patient-types"];

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function usePatientTypes() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: patientTypesApi.list });
}

export function useCreatePatientType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreatePatientTypePayload) => patientTypesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã tạo loại bệnh nhân");
    },
    onError: (err) => toast.error(errorMessage(err, "Tạo loại bệnh nhân thất bại")),
  });
}

export function useUpdatePatientType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdatePatientTypePayload }) =>
      patientTypesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã cập nhật loại bệnh nhân");
    },
    onError: (err) => toast.error(errorMessage(err, "Cập nhật thất bại")),
  });
}

export function useDeletePatientType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => patientTypesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã xoá loại bệnh nhân");
    },
    onError: (err) => toast.error(errorMessage(err, "Xoá thất bại")),
  });
}
