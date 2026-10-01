"use client";

import { FormEvent, useState } from "react";
import { RefreshCw, ShieldPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCreateRole, usePermissions, useRoles } from "@/features/rbac/hooks";

export default function RolesPage() {
  const roles = useRoles();
  const permissions = usePermissions();
  const createRole = useCreateRole();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

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
    </div>
  );
}
