"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast-store";
import { patientsApi } from "./api";
import type { PatientFilters } from "./types";

const PATIENT_KEYS = {
  all: ["admin-patients"] as const,
  detail: (id: string) => ["admin-patients", "detail", id] as const,
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function usePatients(filters: PatientFilters) {
  return useQuery({
    queryKey: [...PATIENT_KEYS.all, filters],
    queryFn: () => patientsApi.list(filters),
    placeholderData: (previous) => previous,
  });
}

export function usePatientDetail(id: string | null, enabled = true) {
  return useQuery({
    queryKey: PATIENT_KEYS.detail(id ?? ""),
    queryFn: () => patientsApi.detail(id!),
    enabled: enabled && !!id,
  });
}

export function useUpdatePatientType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patientTypeId }: { id: string; patientTypeId: number }) =>
      patientsApi.updatePatientType(id, patientTypeId),
    onSuccess: (patient) => {
      queryClient.setQueryData(PATIENT_KEYS.detail(patient.id), patient);
      queryClient.invalidateQueries({ queryKey: PATIENT_KEYS.all });
      toast.success("Đã cập nhật phân loại bệnh nhân");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Cập nhật phân loại bệnh nhân thất bại")),
  });
}
