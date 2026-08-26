"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { doctorAssignmentsApi, type ListDoctorAssignmentsParams } from "./api";
import { toast } from "@/lib/toast-store";
import { ApiError } from "@/lib/api-client";
import type { CreateDoctorAssignmentPayload } from "./types";

const BASE_QUERY_KEY = ["doctor-assignments"];

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

/** params?.activeOnly=true dùng cho "Bác sĩ đang trực" ở Dashboard — chỉ lấy ca trực còn hiệu lực NGAY LÚC NÀY */
export function useDoctorAssignments(params?: ListDoctorAssignmentsParams) {
  return useQuery({
    queryKey: [...BASE_QUERY_KEY, params ?? {}],
    queryFn: () => doctorAssignmentsApi.list(params),
  });
}

export function useCreateDoctorAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDoctorAssignmentPayload) => doctorAssignmentsApi.create(payload),
    onSuccess: () => {
      // Không truyền params -> invalidate MỌI query bắt đầu bằng "doctor-assignments"
      // (cả bản list đầy đủ lẫn bản activeOnly=true ở Dashboard)
      queryClient.invalidateQueries({ queryKey: BASE_QUERY_KEY });
      toast.success("Đã phân công ca trực");
    },
    onError: (err) => toast.error(errorMessage(err, "Phân công ca trực thất bại")),
  });
}

export function useEndDoctorShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => doctorAssignmentsApi.endShift(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BASE_QUERY_KEY });
      toast.success("Đã kết thúc ca trực");
    },
    onError: (err) => toast.error(errorMessage(err, "Kết thúc ca trực thất bại")),
  });
}

export function useDeleteDoctorAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => doctorAssignmentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BASE_QUERY_KEY });
      toast.success("Đã xoá ca trực");
    },
    onError: (err) => toast.error(errorMessage(err, "Xoá thất bại")),
  });
}
