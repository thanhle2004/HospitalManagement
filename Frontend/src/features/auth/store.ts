import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StaffUser } from "./types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: StaffUser | null;
  /** true sau khi zustand đọc xong localStorage (chỉ có ở client) — dùng để
   *  tránh redirect nhầm trước khi biết chắc trạng thái đăng nhập thật sự */
  isHydrated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: StaffUser) => void;
  clearAuth: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isHydrated: false,
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: "staff-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);
