"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { patientAuthApi } from "./api";
import { usePatientAuthStore } from "./store";
import type { CompleteRegistrationRequest, VerifyFirebasePhoneRequest } from "./types";

export function useVerifyFirebasePhone() {
  const router = useRouter();
  return useMutation({
    mutationFn: (payload: VerifyFirebasePhoneRequest) =>
      patientAuthApi.verifyFirebasePhone(payload),
    onSuccess: (result) => {
      if ("requiresRegistration" in result) return;
      const patient = result;
      usePatientAuthStore.getState().setPatient(patient);
      router.replace("/patient");
    },
  });
}

export function useCompletePatientRegistration() {
  const router = useRouter();
  return useMutation({
    mutationFn: (payload: CompleteRegistrationRequest) =>
      patientAuthApi.completeRegistration(payload),
    onSuccess: (patient) => {
      usePatientAuthStore.getState().setPatient(patient);
      router.replace("/patient");
    },
  });
}

let pendingBootstrap: Promise<void> | null = null;

export function usePatientSessionBootstrap(): void {
  const isInitialized = usePatientAuthStore((state) => state.isInitialized);

  useEffect(() => {
    if (isInitialized) return;

    pendingBootstrap ??= patientAuthApi
      .getSession()
      .then((patient) => usePatientAuthStore.getState().setPatient(patient))
      .catch(() => usePatientAuthStore.getState().clearPatient())
      .finally(() => {
        pendingBootstrap = null;
      });
  }, [isInitialized]);
}

export function usePatientLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => patientAuthApi.logout(),
    onSettled: () => {
      usePatientAuthStore.getState().clearPatient();
      queryClient.clear();
      router.replace("/patient/login");
    },
  });
}
