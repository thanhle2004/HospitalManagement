"use client";

import { useAuthStore } from "@/features/auth/store";
import { useLogout } from "@/features/auth/hooks";
import { Button } from "@/components/ui/button";

export default function DoctorPlaceholderPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
      <h1 className="text-lg font-semibold text-slate-900">
        Chào {user?.profile?.fullName ?? user?.email}
      </h1>
      <p className="max-w-sm text-sm text-slate-500">
        Giao diện dành cho Doctor (xem hàng đợi, bắt đầu/hoàn thành khám) sẽ được build ở phase
        tiếp theo. Đăng nhập/đăng xuất đã hoạt động đầy đủ.
      </p>
      <Button variant="outline" onClick={() => logout.mutate()} isLoading={logout.isPending}>
        Đăng xuất
      </Button>
    </div>
  );
}
