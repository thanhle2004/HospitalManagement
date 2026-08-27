"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/store";
import type { StaffRole } from "@/features/auth/types";
import { useSessionBootstrap } from "@/features/auth/hooks";

interface AuthGuardProps {
  children: React.ReactNode;
  /** Role được phép xem route này. Không truyền = mọi Staff đã đăng nhập đều vào được. */
  allow?: StaffRole[];
}

/**
 * Proxy phía server chặn route trước khi render. Guard này tải DTO user an toàn
 * từ backend để hydrate UI và thực hiện redirect theo role cho client navigation.
 */
export function AuthGuard({ children, allow }: AuthGuardProps) {
  const router = useRouter();
  useSessionBootstrap();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!isInitialized) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (allow && !allow.includes(user.role)) {
      router.replace(user.role === "ADMIN" ? "/admin" : "/doctor");
    }
  }, [isInitialized, user, allow, router]);

  const isAuthorized = isInitialized && !!user && (!allow || allow.includes(user.role));

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Đang tải...
      </div>
    );
  }

  return <>{children}</>;
}
