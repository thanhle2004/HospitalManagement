"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast-store";
import { rbacApi } from "./api";
import type { CreateRolePayload, CreateStaffPayload } from "./types";

export function useRoles() {
  return useQuery({ queryKey: ["rbac", "roles"], queryFn: rbacApi.listRoles });
}

export function usePermissions() {
  return useQuery({ queryKey: ["rbac", "permissions"], queryFn: rbacApi.listPermissions });
}

export function useStaffRoles() {
  return useQuery({ queryKey: ["rbac", "staff"], queryFn: rbacApi.listStaff });
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

export function useAssignRole() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleCode, reason }: { userId: string; roleCode: string; reason: string }) => rbacApi.assignRole(userId, roleCode, reason),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["rbac"] });
      toast.success("Đã gán vai trò");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Gán vai trò thất bại"),
  });
}

export function useRevokeRole() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleCode, reason }: { userId: string; roleCode: string; reason: string }) => rbacApi.revokeRole(userId, roleCode, reason),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["rbac"] });
      toast.success("Đã thu hồi vai trò");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Thu hồi vai trò thất bại"),
  });
}

export function useCreateStaff() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateStaffPayload) => rbacApi.createStaff(payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["rbac", "staff"] });
      toast.success("Đã tạo tài khoản nhân viên");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Tạo tài khoản thất bại"),
  });
}

export function useUpdateStaffStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, status, reason }: { userId: string; status: "ACTIVE" | "INACTIVE" | "LOCKED"; reason: string }) => rbacApi.updateStaffStatus(userId, status, reason),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["rbac", "staff"] });
      toast.success("Đã cập nhật trạng thái tài khoản");
    },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Cập nhật trạng thái thất bại"),
  });
}
