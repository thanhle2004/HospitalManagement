"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/store";
import type { StaffRole } from "@/features/auth/types";

interface AuthGuardProps {
  children: React.ReactNode;
  /** Role được phép xem route này. Không truyền = mọi Staff đã đăng nhập đều vào được. */
  allow?: StaffRole[];
}

/**
 * Vì token lưu ở localStorage (không phải httpOnly cookie), Next.js proxy.ts
 * (middleware) chạy trên edge/server KHÔNG đọc được — bảo vệ route phải làm
 * ở client, sau khi zustand hydrate xong từ localStorage.
 */
export function AuthGuard({ children, allow }: AuthGuardProps) {
  const router = useRouter();
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!isHydrated) return;

    if (!accessToken || !user) {
      router.replace("/login");
      return;
    }

    if (allow && !allow.includes(user.role)) {
      router.replace(user.role === "ADMIN" ? "/admin" : "/doctor");
    }
  }, [isHydrated, accessToken, user, allow, router]);

  const isAuthorized = isHydrated && !!accessToken && !!user && (!allow || allow.includes(user.role));

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Đang tải...
      </div>
    );
  }

  return <>{children}</>;
}
