"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast-store";
import { servicesApi } from "./api";
import type {
  CreateServiceDependencyPayload,
  CreateServicePayload,
  CreateServiceStepPayload,
  UpdateServicePayload,
  UpdateServiceStepPayload,
} from "./types";

export const serviceKeys = {
  all: ["clinic-services"] as const,
  detail: (id: number) => ["clinic-services", id] as const,
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function useRefreshService() {
  const queryClient = useQueryClient();
  return (serviceId: number) => {
    queryClient.invalidateQueries({ queryKey: serviceKeys.all });
    queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) });
  };
}

export function useServices() {
  return useQuery({ queryKey: serviceKeys.all, queryFn: servicesApi.list });
}

export function useServiceDetail(serviceId: number | null, enabled = true) {
  return useQuery({
    queryKey: serviceKeys.detail(serviceId ?? 0),
    queryFn: () => servicesApi.detail(serviceId!),
    enabled: enabled && serviceId !== null,
  });
}

export function useCreateService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateServicePayload) => servicesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.all });
      toast.success("Đã tạo dịch vụ khám");
    },
    onError: (error) => toast.error(errorMessage(error, "Tạo dịch vụ thất bại")),
  });
}

export function useUpdateService() {
  const refresh = useRefreshService();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateServicePayload }) =>
      servicesApi.update(id, payload),
    onSuccess: (service) => {
      refresh(service.id);
      toast.success("Đã cập nhật dịch vụ khám");
    },
    onError: (error) => toast.error(errorMessage(error, "Cập nhật dịch vụ thất bại")),
  });
}

export function useDeleteService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => servicesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.all });
      toast.success("Đã xoá dịch vụ khám");
    },
    onError: (error) => toast.error(errorMessage(error, "Xoá dịch vụ thất bại")),
  });
}

export function useCreateServiceStep() {
  const refresh = useRefreshService();
  return useMutation({
    mutationFn: ({ serviceId, payload }: { serviceId: number; payload: CreateServiceStepPayload }) =>
      servicesApi.createStep(serviceId, payload),
    onSuccess: (_, variables) => {
      refresh(variables.serviceId);
      toast.success("Đã thêm bước khám");
    },
    onError: (error) => toast.error(errorMessage(error, "Thêm bước khám thất bại")),
  });
}

export function useUpdateServiceStep() {
  const refresh = useRefreshService();
  return useMutation({
    mutationFn: ({
      serviceId,
      stepId,
      payload,
    }: {
      serviceId: number;
      stepId: number;
      payload: UpdateServiceStepPayload;
    }) => servicesApi.updateStep(serviceId, stepId, payload),
    onSuccess: (_, variables) => {
      refresh(variables.serviceId);
      toast.success("Đã cập nhật bước khám");
    },
    onError: (error) => toast.error(errorMessage(error, "Cập nhật bước khám thất bại")),
  });
}

export function useDeleteServiceStep() {
  const refresh = useRefreshService();
  return useMutation({
    mutationFn: ({ serviceId, stepId }: { serviceId: number; stepId: number }) =>
      servicesApi.removeStep(serviceId, stepId),
    onSuccess: (_, variables) => {
      refresh(variables.serviceId);
      toast.success("Đã xoá bước khám");
    },
    onError: (error) => toast.error(errorMessage(error, "Xoá bước khám thất bại")),
  });
}

export function useCreateServiceDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      serviceId,
      payload,
    }: {
      serviceId: number;
      payload: CreateServiceDependencyPayload;
    }) => servicesApi.createDependency(serviceId, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(variables.serviceId) });
      toast.success("Đã thêm điều kiện trước");
    },
    onError: (error) => toast.error(errorMessage(error, "Thêm điều kiện thất bại")),
  });
}

export function useDeleteServiceDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      serviceId,
      stepId,
      requiredStepId,
    }: {
      serviceId: number;
      stepId: number;
      requiredStepId: number;
    }) => servicesApi.removeDependency(serviceId, stepId, requiredStepId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: serviceKeys.detail(variables.serviceId) });
      toast.success("Đã gỡ điều kiện trước");
    },
    onError: (error) => toast.error(errorMessage(error, "Gỡ điều kiện thất bại")),
  });
}
