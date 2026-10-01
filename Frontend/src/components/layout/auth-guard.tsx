"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/features/auth/store";
import type { StaffWorkspace } from "@/features/auth/types";
import { useSessionBootstrap } from "@/features/auth/hooks";
import { workspacePathFor } from "@/features/auth/workspace";

interface AuthGuardProps {
  children: React.ReactNode;
  /** Workspace được phép xem route này; backend permission vẫn là security boundary. */
  allowWorkspace?: StaffWorkspace;
}

/**
 * Proxy phía server chặn route trước khi render. Guard này tải DTO user an toàn
 * từ backend để hydrate UI và thực hiện workspace navigation.
 */
export function AuthGuard({ children, allowWorkspace }: AuthGuardProps) {
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

    if (allowWorkspace && user.workspace !== allowWorkspace) {
      router.replace(workspacePathFor(user.workspace));
    }
  }, [isInitialized, user, allowWorkspace, router]);

  const isAuthorized =
    isInitialized &&
    !!user &&
    (!allowWorkspace || user.workspace === allowWorkspace);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Đang tải...
      </div>
    );
  }

  return <>{children}</>;
}
