"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { doctorsApi } from "./api";
import { toast } from "@/lib/toast-store";
import { ApiError } from "@/lib/api-client";
import type { CreateDoctorPayload } from "./types";

const QUERY_KEY = ["doctors"];

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

export function useDoctors() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: doctorsApi.list });
}

export function useCreateDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDoctorPayload) => doctorsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã tạo tài khoản Doctor");
    },
    onError: (err) => toast.error(errorMessage(err, "Tạo tài khoản thất bại")),
  });
}

export function useLockDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => doctorsApi.lock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã khoá tài khoản");
    },
    onError: (err) => toast.error(errorMessage(err, "Khoá tài khoản thất bại")),
  });
}

export function useUnlockDoctor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => doctorsApi.unlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast.success("Đã mở khoá tài khoản");
    },
    onError: (err) => toast.error(errorMessage(err, "Mở khoá tài khoản thất bại")),
  });
}
