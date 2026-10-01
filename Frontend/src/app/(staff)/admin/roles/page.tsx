"use client";

import { FormEvent, useState } from "react";
import { Lock, Plus, RefreshCw, ShieldPlus, Unlock, UserCog, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAssignRole, useCreateRole, useCreateStaff, usePermissions, useRevokeRole, useRoles, useStaffRoles, useUpdateStaffStatus } from "@/features/rbac/hooks";
import type { StaffRoleCode, StaffRoleSummary } from "@/features/rbac/types";

const STAFF_ROLES: Array<{ code: StaffRoleCode; label: string }> = [
  { code: "ADMIN", label: "Quản trị viên" },
  { code: "DOCTOR", label: "Bác sĩ" },
  { code: "NURSE", label: "Điều dưỡng" },
  { code: "RECEPTIONIST", label: "Lễ tân" },
  { code: "LAB_TECHNICIAN", label: "Kỹ thuật viên xét nghiệm" },
  { code: "PHARMACIST", label: "Dược sĩ" },
  { code: "CASHIER", label: "Thu ngân" },
];

export default function RolesPage() {
  const roles = useRoles();
  const permissions = usePermissions();
  const createRole = useCreateRole();
  const staff = useStaffRoles();
  const assignRole = useAssignRole();
  const revokeRole = useRevokeRole();
  const createStaff = useCreateStaff();
  const updateStaffStatus = useUpdateStaffStatus();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [staffTarget, setStaffTarget] = useState<StaffRoleSummary | null>(null);
  const [roleCode, setRoleCode] = useState("");
  const [reason, setReason] = useState("");
  const [staffFormOpen, setStaffFormOpen] = useState(false);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffRole, setStaffRole] = useState<StaffRoleCode>("DOCTOR");
  const [staffReason, setStaffReason] = useState("");
  const [statusTarget, setStatusTarget] = useState<StaffRoleSummary | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const selectedStaff = staff.data?.items.find((member) => member.id === staffTarget?.id) ?? staffTarget;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createRole.mutate(
      { code, name, description: description || undefined, permissionCodes: selected },
      { onSuccess: () => { setOpen(false); setCode(""); setName(""); setDescription(""); setSelected([]); } },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Vai trò và quyền</h1>
          <p className="text-sm text-slate-500">Quản lý permission tập trung cho tài khoản nhân viên</p>
        </div>
        <Button onClick={() => setOpen(true)}><ShieldPlus className="h-4 w-4" />Tạo vai trò</Button>
      </div>

      {roles.isError ? (
        <Card className="p-8 text-center">
          <p className="mb-4 text-sm text-red-600">Không tải được danh sách vai trò.</p>
          <Button variant="outline" onClick={() => roles.refetch()}><RefreshCw className="h-4 w-4" />Thử lại</Button>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>Mã</TableHead><TableHead>Tên</TableHead><TableHead>Quyền</TableHead><TableHead>Nhân viên</TableHead></TableRow></TableHeader>
            <TableBody>
              {roles.isLoading && <TableRow><TableCell colSpan={4} className="py-8 text-center text-slate-500">Đang tải...</TableCell></TableRow>}
              {roles.data?.items.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-slate-500">Chưa có vai trò nào</TableCell></TableRow>}
              {roles.data?.items.map((role) => (
                <TableRow key={role.id}>
                  <TableCell><Badge variant={role.isSystem ? "info" : "default"}>{role.code}</Badge></TableCell>
                  <TableCell><div className="font-medium text-slate-900">{role.name}</div><div className="text-xs text-slate-500">{role.description ?? "—"}</div></TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{role.permissions.length ? role.permissions.map((permission) => <Badge key={permission}>{permission}</Badge>) : <span className="text-slate-400">Chưa cấp quyền</span>}</div></TableCell>
                  <TableCell>{role.assignedUserCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold text-slate-900">Phân quyền nhân viên</h2><p className="text-sm text-slate-500">Gán hoặc thu hồi vai trò; mọi thay đổi đều yêu cầu lý do và được audit.</p></div><Button variant="outline" onClick={() => setStaffFormOpen(true)}><Plus className="h-4 w-4" />Tạo nhân viên</Button></div>
      </div>
      {staff.isError ? (
        <Card className="p-8 text-center"><p className="mb-4 text-sm text-red-600">Không tải được danh sách nhân viên.</p><Button variant="outline" onClick={() => staff.refetch()}><RefreshCw className="h-4 w-4" />Thử lại</Button></Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>Nhân viên</TableHead><TableHead>Trạng thái</TableHead><TableHead>Vai trò</TableHead><TableHead className="text-right">Hành động</TableHead></TableRow></TableHeader>
            <TableBody>
              {staff.isLoading && <TableRow><TableCell colSpan={4} className="py-8 text-center text-slate-500">Đang tải...</TableCell></TableRow>}
              {staff.data?.items.length === 0 && <TableRow><TableCell colSpan={4} className="py-8 text-center text-slate-500">Chưa có nhân viên</TableCell></TableRow>}
              {staff.data?.items.map((member) => (
                <TableRow key={member.id}>
                  <TableCell><div className="font-medium text-slate-900">{member.fullName ?? "Chưa có hồ sơ"}</div><div className="text-xs text-slate-500">{member.email}</div></TableCell>
                  <TableCell><Badge variant={member.status === "ACTIVE" ? "success" : member.status === "LOCKED" ? "destructive" : "default"}>{member.status}</Badge></TableCell>
                  <TableCell><div className="flex flex-wrap gap-1">{member.roles.map((assignedRole) => <Badge key={assignedRole}>{assignedRole}</Badge>)}</div></TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => { setStaffTarget(member); setRoleCode(""); setReason(""); }}><UserCog className="h-4 w-4" />Phân quyền</Button><Button variant="ghost" size="sm" title={member.status === "ACTIVE" ? "Khóa tài khoản" : "Mở tài khoản"} onClick={() => { setStatusTarget(member); setStatusReason(""); }}>{member.status === "ACTIVE" ? <Lock className="h-4 w-4 text-red-600" /> : <Unlock className="h-4 w-4 text-green-600" />}</Button></div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="Tạo vai trò" description="Vai trò mới chỉ có các quyền được chọn bên dưới.">
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2"><Label htmlFor="role-code">Mã vai trò</Label><Input id="role-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="NURSE" required minLength={2} /></div>
            <div className="space-y-2"><Label htmlFor="role-name">Tên vai trò</Label><Input id="role-name" value={name} onChange={(event) => setName(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="role-description">Mô tả</Label><Input id="role-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div>
            <fieldset className="space-y-2"><legend className="text-sm font-medium">Quyền</legend>
              {permissions.isLoading && <p className="text-sm text-slate-500">Đang tải quyền...</p>}
              {permissions.isError && <Button type="button" variant="outline" onClick={() => permissions.refetch()}>Thử tải lại</Button>}
              {permissions.data?.items.map((permission) => (
                <label key={permission.code} className="flex items-start gap-2 rounded border p-3 text-sm">
                  <input type="checkbox" className="mt-1" checked={selected.includes(permission.code)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, permission.code] : current.filter((codeValue) => codeValue !== permission.code))} />
                  <span><span className="font-medium">{permission.code}</span><span className="block text-slate-500">{permission.name}</span></span>
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Hủy</Button><Button type="submit" disabled={createRole.isPending || permissions.isError}>{createRole.isPending ? "Đang tạo..." : "Tạo vai trò"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusTarget} onOpenChange={(value) => !value && setStatusTarget(null)}>
        <DialogContent title={statusTarget?.status === "ACTIVE" ? "Khóa tài khoản?" : "Mở lại tài khoản?"} description={statusTarget ? `${statusTarget.fullName ?? statusTarget.email} — thao tác sẽ vô hiệu toàn bộ access token cũ.` : undefined}>
          <div className="space-y-4">
            <div className="space-y-2"><Label htmlFor="status-reason">Lý do thay đổi</Label><Input id="status-reason" value={statusReason} onChange={(event) => setStatusReason(event.target.value)} minLength={3} required /></div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setStatusTarget(null)}>Hủy</Button><Button variant={statusTarget?.status === "ACTIVE" ? "destructive" : "default"} disabled={!statusTarget || statusReason.trim().length < 3 || updateStaffStatus.isPending} onClick={() => statusTarget && updateStaffStatus.mutate({ userId: statusTarget.id, status: statusTarget.status === "ACTIVE" ? "LOCKED" : "ACTIVE", reason: statusReason }, { onSuccess: () => setStatusTarget(null) })}>{updateStaffStatus.isPending ? "Đang cập nhật..." : "Xác nhận"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={staffFormOpen} onOpenChange={setStaffFormOpen}>
        <DialogContent title="Tạo tài khoản nhân viên" description="Tài khoản được tạo cùng role assignment trong một transaction.">
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); createStaff.mutate({ email: staffEmail, password: staffPassword, fullName: staffName, phone: staffPhone || undefined, role: staffRole, reason: staffReason }, { onSuccess: () => { setStaffFormOpen(false); setStaffEmail(""); setStaffPassword(""); setStaffName(""); setStaffPhone(""); setStaffReason(""); } }); }}>
            <div className="space-y-2"><Label htmlFor="staff-name">Họ tên</Label><Input id="staff-name" value={staffName} onChange={(event) => setStaffName(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="staff-email">Email</Label><Input id="staff-email" type="email" value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} required /></div>
            <div className="space-y-2"><Label htmlFor="staff-password">Mật khẩu tạm thời</Label><Input id="staff-password" type="password" value={staffPassword} onChange={(event) => setStaffPassword(event.target.value)} minLength={8} required /></div>
            <div className="space-y-2"><Label htmlFor="staff-phone">Số điện thoại</Label><Input id="staff-phone" value={staffPhone} onChange={(event) => setStaffPhone(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="staff-role">Vai trò ban đầu</Label><select id="staff-role" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={staffRole} onChange={(event) => setStaffRole(event.target.value as StaffRoleCode)}>{STAFF_ROLES.map((role) => <option key={role.code} value={role.code}>{role.label}</option>)}</select></div>
            <div className="space-y-2"><Label htmlFor="staff-create-reason">Lý do tạo</Label><Input id="staff-create-reason" value={staffReason} onChange={(event) => setStaffReason(event.target.value)} minLength={3} required /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setStaffFormOpen(false)}>Hủy</Button><Button type="submit" disabled={createStaff.isPending}>{createStaff.isPending ? "Đang tạo..." : "Tạo tài khoản"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!staffTarget} onOpenChange={(value) => !value && setStaffTarget(null)}>
        <DialogContent title="Phân quyền nhân viên" description={selectedStaff ? `${selectedStaff.fullName ?? selectedStaff.email} — ${selectedStaff.email}` : undefined}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Vai trò hiện tại</Label>
              <div className="flex flex-wrap gap-2">
                {selectedStaff?.roles.map((assignedRole) => (
                  <Button key={assignedRole} type="button" variant="outline" size="sm" disabled={revokeRole.isPending || selectedStaff.roles.length <= 1 || reason.trim().length < 3} title={selectedStaff.roles.length <= 1 ? "Không thể thu hồi vai trò cuối cùng" : "Thu hồi vai trò"} onClick={() => revokeRole.mutate({ userId: selectedStaff.id, roleCode: assignedRole, reason })}>
                    {assignedRole}<X className="h-3 w-3 text-red-600" />
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2"><Label htmlFor="assignment-reason">Lý do thay đổi</Label><Input id="assignment-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Phân công nhiệm vụ mới" minLength={3} /></div>
            <div className="space-y-2"><Label htmlFor="assignment-role">Vai trò cần gán</Label>
              <select id="assignment-role" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={roleCode} onChange={(event) => setRoleCode(event.target.value)}>
                <option value="">Chọn vai trò</option>
                {roles.data?.items.filter((role) => !selectedStaff?.roles.includes(role.code)).map((role) => <option key={role.code} value={role.code}>{role.name} ({role.code})</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setStaffTarget(null)}>Đóng</Button><Button disabled={!selectedStaff || !roleCode || reason.trim().length < 3 || assignRole.isPending} onClick={() => selectedStaff && assignRole.mutate({ userId: selectedStaff.id, roleCode, reason }, { onSuccess: () => { setRoleCode(""); setReason(""); } })}>{assignRole.isPending ? "Đang gán..." : "Gán vai trò"}</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
