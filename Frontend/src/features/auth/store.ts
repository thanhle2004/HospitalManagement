import { create } from "zustand";
import type { StaffUser } from "./types";

interface AuthState {
  user: StaffUser | null;
  /** true sau khi đã kiểm tra cookie HttpOnly với backend ít nhất một lần. */
  isInitialized: boolean;
  setUser: (user: StaffUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isInitialized: false,
  setUser: (user) => set({ user, isInitialized: true }),
  clearAuth: () => set({ user: null, isInitialized: true }),
}));
