"use client";

import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { authApi } from "./api";
import { useAuthStore } from "./store";
import type { LoginRequest } from "./types";

function dashboardPathFor(role: "ADMIN" | "DOCTOR") {
  return role === "ADMIN" ? "/admin" : "/doctor";
}

export function useLogin() {
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: LoginRequest) => authApi.login(payload),
    onSuccess: (user) => {
      useAuthStore.getState().setUser(user);
      router.replace(dashboardPathFor(user.role));
    },
  });
}

let pendingBootstrap: Promise<void> | null = null;

export function useSessionBootstrap(): void {
  const isInitialized = useAuthStore((state) => state.isInitialized);

  useEffect(() => {
    if (isInitialized) return;

    pendingBootstrap ??= authApi
      .getSession()
      .then((user) => useAuthStore.getState().setUser(user))
      .catch(() => useAuthStore.getState().clearAuth())
      .finally(() => {
        pendingBootstrap = null;
      });
  }, [isInitialized]);
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      // Luôn xoá user khỏi bộ nhớ UI; Route Handler cũng xoá cookie HttpOnly.
      useAuthStore.getState().clearAuth();
      queryClient.clear();
      router.replace("/login");
    },
  });
}
