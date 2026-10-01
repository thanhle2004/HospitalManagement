"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Monitor, RefreshCw, ShieldX } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { staffProfileApi } from "@/features/auth/profile";
import { staffSessionsApi } from "@/features/auth/sessions";
import { useAuthStore } from "@/features/auth/store";
import type { Gender } from "@/features/auth/types";
import { ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast-store";

const errorMessage = (error: Error) => error instanceof ApiError ? error.message : "Có lỗi xảy ra. Vui lòng thử lại.";

export default function StaffProfilePage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user)!;
  const setUser = useAuthStore((state) => state.setUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const client = useQueryClient();
  const profile = user.profile;
  const [profileForm, setProfileForm] = useState({ fullName: profile?.fullName ?? "", phone: profile?.phone ?? "", gender: profile?.gender ?? "", birthday: profile?.birthday?.slice(0, 10) ?? "", address: profile?.address ?? "", description: profile?.description ?? "" });
  const [passwordForm, setPasswordForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [confirmOthers, setConfirmOthers] = useState(false);
  const [confirmSession, setConfirmSession] = useState<string | null>(null);

  const updateProfile = useMutation({ mutationFn: staffProfileApi.update, onSuccess: (updated) => { setUser({ ...user, ...updated }); toast.success("Đã cập nhật hồ sơ"); }, onError: (error: Error) => toast.error(errorMessage(error)) });
  const changePassword = useMutation({ mutationFn: staffProfileApi.changePassword, onSuccess: async () => { await fetch("/api/session", { method: "DELETE" }).catch(() => undefined); clearAuth(); toast.success("Đã đổi mật khẩu. Vui lòng đăng nhập lại."); router.replace("/login"); }, onError: (error: Error) => toast.error(errorMessage(error)) });
  const sessions = useQuery({ queryKey: ["staff-sessions"], queryFn: staffSessionsApi.list });
  const revoke = useMutation({ mutationFn: staffSessionsApi.revoke, onSuccess: () => { setConfirmSession(null); client.invalidateQueries({ queryKey: ["staff-sessions"] }); toast.success("Đã thu hồi phiên"); }, onError: (error: Error) => toast.error(errorMessage(error)) });
  const revokeOthers = useMutation({ mutationFn: staffSessionsApi.revokeOthers, onSuccess: () => { setConfirmOthers(false); client.invalidateQueries({ queryKey: ["staff-sessions"] }); toast.success("Đã đăng xuất các thiết bị khác"); }, onError: (error: Error) => toast.error(errorMessage(error)) });

  const submitProfile = (event: FormEvent) => { event.preventDefault(); updateProfile.mutate({ fullName: profileForm.fullName, phone: profileForm.phone, gender: profileForm.gender ? profileForm.gender as Gender : undefined, birthday: profileForm.birthday || undefined, address: profileForm.address, description: profileForm.description }); };
  const submitPassword = (event: FormEvent) => { event.preventDefault(); if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error("Xác nhận mật khẩu không khớp"); return; } changePassword.mutate({ oldPassword: passwordForm.oldPassword, newPassword: passwordForm.newPassword }); };

  return <div className="space-y-6">
    <div><h1 className="text-xl font-semibold">Hồ sơ và bảo mật</h1><p className="text-sm text-slate-500">{profile?.fullName ?? user.email} — {user.email}</p></div>
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="p-6"><h2 className="mb-4 font-semibold">Thông tin cá nhân</h2><form className="space-y-4" onSubmit={submitProfile}>
        <div><Label htmlFor="fullName">Họ và tên</Label><Input id="fullName" required maxLength={120} value={profileForm.fullName} onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}/></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="phone">Số điện thoại</Label><Input id="phone" maxLength={30} value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}/></div><div><Label htmlFor="gender">Giới tính</Label><Select id="gender" value={profileForm.gender} onChange={(e) => setProfileForm({ ...profileForm, gender: e.target.value })}><option value="">Chưa chọn</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></Select></div></div>
        <div><Label htmlFor="birthday">Ngày sinh</Label><Input id="birthday" type="date" value={profileForm.birthday} onChange={(e) => setProfileForm({ ...profileForm, birthday: e.target.value })}/></div>
        <div><Label htmlFor="address">Địa chỉ</Label><Input id="address" maxLength={500} value={profileForm.address} onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}/></div>
        <div><Label htmlFor="description">Giới thiệu</Label><Textarea id="description" maxLength={1000} value={profileForm.description} onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}/></div>
        <Button type="submit" disabled={updateProfile.isPending}>{updateProfile.isPending ? "Đang lưu..." : "Lưu hồ sơ"}</Button>
      </form></Card>
      <Card className="p-6"><h2 className="mb-1 font-semibold">Đổi mật khẩu</h2><p className="mb-4 text-sm text-slate-500">Thao tác này sẽ đăng xuất tất cả thiết bị.</p><form className="space-y-4" onSubmit={submitPassword}>
        <div><Label htmlFor="oldPassword">Mật khẩu hiện tại</Label><Input id="oldPassword" type="password" required maxLength={128} autoComplete="current-password" value={passwordForm.oldPassword} onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}/></div>
        <div><Label htmlFor="newPassword">Mật khẩu mới</Label><Input id="newPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}/></div>
        <div><Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label><Input id="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}/></div>
        <Button type="submit" disabled={changePassword.isPending}>{changePassword.isPending ? "Đang đổi..." : "Đổi mật khẩu"}</Button>
      </form></Card>
    </div>
    <div className="flex items-center justify-between"><h2 className="font-semibold">Phiên đăng nhập</h2><Button variant="outline" disabled={revokeOthers.isPending} onClick={() => setConfirmOthers(true)}><ShieldX className="h-4 w-4"/>Đăng xuất thiết bị khác</Button></div>
    {sessions.isError ? <Card className="p-8 text-center"><p className="mb-3 text-red-600">Không tải được danh sách phiên.</p><Button variant="outline" onClick={() => sessions.refetch()}><RefreshCw className="h-4 w-4"/>Thử lại</Button></Card> : <div className="grid gap-3">{sessions.isLoading && <Card className="p-6 text-slate-500">Đang tải...</Card>}{sessions.data?.length === 0 && <Card className="p-6 text-slate-500">Không có phiên hoạt động.</Card>}{sessions.data?.map((session) => <Card key={session.id} className="flex items-center justify-between gap-4 p-4"><div className="flex min-w-0 gap-3"><Monitor className="mt-1 h-5 w-5 shrink-0 text-slate-500"/><div className="min-w-0"><div className="flex gap-2"><span className="truncate font-medium">{session.deviceInfo ?? "Thiết bị không xác định"}</span>{session.current && <Badge variant="success">Hiện tại</Badge>}</div><p className="text-xs text-slate-500">IP {session.ipAddress ?? "—"} · Tạo {new Date(session.createdAt).toLocaleString("vi-VN")}</p></div></div><Button variant="outline" size="sm" disabled={session.current || revoke.isPending} onClick={() => setConfirmSession(session.id)}>Thu hồi</Button></Card>)}</div>}
    <ConfirmDialog open={confirmOthers} onOpenChange={setConfirmOthers} title="Đăng xuất các thiết bị khác?" description="Mọi phiên đăng nhập khác sẽ bị thu hồi. Phiên hiện tại vẫn được giữ lại." confirmLabel="Đăng xuất" isLoading={revokeOthers.isPending} onConfirm={() => revokeOthers.mutate()}/>
    <ConfirmDialog open={confirmSession !== null} onOpenChange={(open) => !open && setConfirmSession(null)} title="Thu hồi phiên đăng nhập?" description="Thiết bị này sẽ phải đăng nhập lại." confirmLabel="Thu hồi" isLoading={revoke.isPending} onConfirm={() => confirmSession && revoke.mutate(confirmSession)}/>
  </div>;
}
