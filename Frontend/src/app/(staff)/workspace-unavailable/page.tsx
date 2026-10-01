"use client";

import { ShieldAlert } from "lucide-react";
import { AuthGuard } from "@/components/layout/auth-guard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLogout } from "@/features/auth/hooks";
import { useAuthStore } from "@/features/auth/store";

function WorkspaceUnavailableContent() {
  const user = useAuthStore((state) => state.user);
  const logout = useLogout();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg p-8 text-center">
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-600" />
        <h1 className="text-xl font-semibold">Chưa có không gian làm việc</h1>
        <p className="mt-2 text-sm text-slate-600">
          Tài khoản đã đăng nhập nhưng các vai trò hiện tại chưa có workspace
          nghiệp vụ hoàn chỉnh. Vui lòng liên hệ quản trị viên.
        </p>
        <p className="mt-4 text-xs text-slate-500">
          Vai trò: {user?.effectiveRoles.join(", ") || "Chưa được gán"}
        </p>
        <Button
          className="mt-6"
          variant="outline"
          isLoading={logout.isPending}
          onClick={() => logout.mutate()}
        >
          Đăng xuất
        </Button>
      </Card>
    </main>
  );
}

export default function WorkspaceUnavailablePage() {
  return (
    <AuthGuard>
      <WorkspaceUnavailableContent />
    </AuthGuard>
  );
}
