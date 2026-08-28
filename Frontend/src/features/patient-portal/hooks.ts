"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patientPortalApi } from "./api";

export const patientPortalKeys = {
  services: ["patient-portal", "services"] as const,
  service: (id: number) => ["patient-portal", "services", id] as const,
  visits: ["patient-portal", "visits"] as const,
  visit: (id: string) => ["patient-portal", "visits", id] as const,
};

export function usePatientServices() {
  return useQuery({
    queryKey: patientPortalKeys.services,
    queryFn: patientPortalApi.services,
  });
}

export function usePatientServiceDetail(id: number | null) {
  return useQuery({
    queryKey: patientPortalKeys.service(id ?? 0),
    queryFn: () => patientPortalApi.serviceDetail(id!),
    enabled: id !== null,
  });
}

export function usePatientVisits() {
  return useQuery({
    queryKey: patientPortalKeys.visits,
    queryFn: patientPortalApi.visits,
    refetchInterval: 10_000,
  });
}

export function usePatientVisit(id: string) {
  return useQuery({
    queryKey: patientPortalKeys.visit(id),
    queryFn: () => patientPortalApi.visitDetail(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "COMPLETED" || status === "CANCELLED" ? false : 5_000;
    },
  });
}

export function useCreatePatientVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (flowId: number) => patientPortalApi.createVisit(flowId),
    onSuccess: (visit) => {
      queryClient.invalidateQueries({ queryKey: patientPortalKeys.visits });
      queryClient.setQueryData(patientPortalKeys.visit(visit.id), visit);
    },
  });
}
