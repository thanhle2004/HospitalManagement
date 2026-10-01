"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor, RefreshCw, ShieldX } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { staffSessionsApi } from "@/features/auth/sessions";
import { useAuthStore } from "@/features/auth/store";
import { toast } from "@/lib/toast-store";

export default function StaffProfilePage() {
  const user = useAuthStore((state) => state.user);
  const client = useQueryClient();
  const [confirmOthers, setConfirmOthers] = useState(false);
  const sessions = useQuery({ queryKey: ["staff-sessions"], queryFn: staffSessionsApi.list });
  const revoke = useMutation({
    mutationFn: staffSessionsApi.revoke,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["staff-sessions"] });
      toast.success("Đã thu hồi phiên");
    },
    onError: () => toast.error("Không thể thu hồi phiên"),
  });
  const revokeOthers = useMutation({
    mutationFn: staffSessionsApi.revokeOthers,
    onSuccess: () => {
      setConfirmOthers(false);
      client.invalidateQueries({ queryKey: ["staff-sessions"] });
      toast.success("Đã đăng xuất các thiết bị khác");
    },
    onError: () => toast.error("Không thể đăng xuất các thiết bị khác"),
  });

  return <div className="space-y-6"><div><h1 className="text-xl font-semibold">Hồ sơ và phiên đăng nhập</h1><p className="text-sm text-slate-500">{user?.profile?.fullName ?? user?.email} — {user?.email}</p></div>
    <div className="flex justify-end"><Button variant="outline" disabled={revokeOthers.isPending} onClick={() => setConfirmOthers(true)}><ShieldX className="h-4 w-4" />Đăng xuất thiết bị khác</Button></div>
    {sessions.isError ? <Card className="p-8 text-center"><p className="mb-3 text-red-600">Không tải được danh sách phiên.</p><Button variant="outline" onClick={() => sessions.refetch()}><RefreshCw className="h-4 w-4" />Thử lại</Button></Card> : <div className="grid gap-3">{sessions.isLoading && <Card className="p-6 text-slate-500">Đang tải...</Card>}{sessions.data?.length === 0 && <Card className="p-6 text-slate-500">Không có phiên hoạt động.</Card>}{sessions.data?.map((session) => <Card key={session.id} className="flex items-center justify-between gap-4 p-4"><div className="flex min-w-0 gap-3"><Monitor className="mt-1 h-5 w-5 shrink-0 text-slate-500"/><div className="min-w-0"><div className="flex gap-2"><span className="font-medium">{session.deviceInfo ?? "Thiết bị không xác định"}</span>{session.current && <Badge variant="success">Hiện tại</Badge>}</div><p className="text-xs text-slate-500">IP {session.ipAddress ?? "—"} · Tạo {new Date(session.createdAt).toLocaleString("vi-VN")}</p></div></div><Button variant="outline" size="sm" disabled={session.current || revoke.isPending} onClick={() => revoke.mutate(session.id)}>Thu hồi</Button></Card>)}</div>}
    <ConfirmDialog open={confirmOthers} onOpenChange={setConfirmOthers} title="Đăng xuất các thiết bị khác?" description="Mọi phiên đăng nhập khác của tài khoản sẽ bị thu hồi. Phiên hiện tại vẫn được giữ lại." confirmLabel="Đăng xuất" isLoading={revokeOthers.isPending} onConfirm={() => revokeOthers.mutate()} />
  </div>;
}
