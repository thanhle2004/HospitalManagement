"use client";

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
    onSuccess: async (tokens) => {
      // Set token TRƯỚC khi gọi getMe() — apiFetch cần đọc token từ store để đính kèm header
      useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
      const user = await authApi.getMe();
      useAuthStore.getState().setUser(user);
      router.replace(dashboardPathFor(user.role));
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      // Luôn xoá auth local dù API logout có lỗi (vd mất mạng) — trải nghiệm
      // người dùng ưu tiên "chắc chắn đăng xuất được" hơn là đợi server xác nhận
      useAuthStore.getState().clearAuth();
      queryClient.clear();
      router.replace("/login");
    },
  });
}
