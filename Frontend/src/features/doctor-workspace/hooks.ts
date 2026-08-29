"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast-store";
import { doctorWorkspaceApi } from "./api";

const DUTY_KEY = ["doctor-duty-assignments"] as const;
const QUEUE_KEY = ["doctor-queue"] as const;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function useDoctorDutyAssignments() {
  return useQuery({
    queryKey: DUTY_KEY,
    queryFn: doctorWorkspaceApi.dutyAssignments,
    refetchInterval: 15_000,
  });
}

export function useConfirmDutyRoom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: doctorWorkspaceApi.confirmRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DUTY_KEY });
      queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
      toast.success("Đã xác nhận phòng trực");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Không thể xác nhận phòng trực")),
  });
}

export function useDoctorQueue(enabled: boolean) {
  return useQuery({
    queryKey: QUEUE_KEY,
    queryFn: doctorWorkspaceApi.queue,
    enabled,
    refetchInterval: enabled ? 5_000 : false,
  });
}

export function useStartExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: doctorWorkspaceApi.startExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
      toast.success("Đã bắt đầu khám bệnh");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Không thể bắt đầu khám")),
  });
}

export function useCompleteExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: doctorWorkspaceApi.completeExam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
      toast.success("Đã hoàn thành lượt khám");
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Không thể hoàn thành lượt khám")),
  });
}
