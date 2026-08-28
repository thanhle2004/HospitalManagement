"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { patientAuthApi } from "./api";
import { usePatientAuthStore } from "./store";
import type {
  OtpChallengeRequest,
  VerifyLoginRequest,
  VerifyRegisterRequest,
} from "./types";

export function useOtpChallenge() {
  return useMutation({
    mutationFn: (payload: OtpChallengeRequest) => patientAuthApi.requestOtp(payload),
  });
}

export function useVerifyPatientLogin() {
  const router = useRouter();
  return useMutation({
    mutationFn: (payload: VerifyLoginRequest) => patientAuthApi.verifyLogin(payload),
    onSuccess: (patient) => {
      usePatientAuthStore.getState().setPatient(patient);
      router.replace("/patient");
    },
  });
}

export function useVerifyPatientRegister() {
  const router = useRouter();
  return useMutation({
    mutationFn: (payload: VerifyRegisterRequest) => patientAuthApi.verifyRegister(payload),
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
