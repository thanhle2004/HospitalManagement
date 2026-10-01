"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast-store";
import { rbacApi } from "./api";
import type { CreateRolePayload } from "./types";

export function useRoles() {
  return useQuery({ queryKey: ["rbac", "roles"], queryFn: rbacApi.listRoles });
}

export function usePermissions() {
  return useQuery({ queryKey: ["rbac", "permissions"], queryFn: rbacApi.listPermissions });
}

export function useCreateRole() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRolePayload) => rbacApi.createRole(payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["rbac", "roles"] });
      toast.success("Đã tạo vai trò");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Tạo vai trò thất bại"),
  });
}
