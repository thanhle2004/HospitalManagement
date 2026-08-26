"use client";

import { useState } from "react";
import { Plus, Lock, Unlock } from "lucide-react";
import { useDoctors, useLockDoctor, useUnlockDoctor } from "@/features/doctors/hooks";
import { DoctorFormDialog } from "@/features/doctors/components/doctor-form-dialog";
import type { StaffUser } from "@/features/auth/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_BADGE: Record<StaffUser["status"], "success" | "destructive" | "default"> = {
  ACTIVE: "success",
  LOCKED: "destructive",
  INACTIVE: "default",
};
const STATUS_LABEL: Record<StaffUser["status"], string> = {
  ACTIVE: "Hoạt động",
  LOCKED: "Đã khoá",
  INACTIVE: "Ngừng hoạt động",
};

export default function DoctorsPage() {
  const doctors = useDoctors();
  const lockMutation = useLockDoctor();
  const unlockMutation = useUnlockDoctor();

  const [formOpen, setFormOpen] = useState(false);
  const [lockTarget, setLockTarget] = useState<StaffUser | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Bác sĩ</h1>
          <p className="text-sm text-slate-500">Quản lý tài khoản Doctor</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Tạo tài khoản
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Họ tên</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>SĐT</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Đăng nhập gần nhất</TableHead>
              <TableHead className="w-20 text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {doctors.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500">
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {doctors.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500">
                  Chưa có tài khoản Doctor nào
                </TableCell>
              </TableRow>
            )}
            {doctors.data?.map((doctor) => (
              <TableRow key={doctor.id}>
                <TableCell className="font-medium text-slate-900">
                  {doctor.profile?.fullName ?? "—"}
                </TableCell>
                <TableCell>{doctor.email}</TableCell>
                <TableCell>{doctor.profile?.phone ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[doctor.status]}>{STATUS_LABEL[doctor.status]}</Badge>
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {doctor.lastLoginAt
                    ? new Date(doctor.lastLoginAt).toLocaleString("vi-VN")
                    : "Chưa từng đăng nhập"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    {doctor.status === "LOCKED" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Mở khoá"
                        onClick={() => unlockMutation.mutate(doctor.id)}
                        disabled={unlockMutation.isPending}
                      >
                        <Unlock className="h-4 w-4 text-green-600" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" title="Khoá" onClick={() => setLockTarget(doctor)}>
                        <Lock className="h-4 w-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <DoctorFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <ConfirmDialog
        open={!!lockTarget}
        onOpenChange={(open) => !open && setLockTarget(null)}
        title="Khoá tài khoản Doctor?"
        description={`"${lockTarget?.profile?.fullName ?? lockTarget?.email}" sẽ không đăng nhập được cho tới khi mở khoá lại.`}
        isLoading={lockMutation.isPending}
        onConfirm={() => {
          if (!lockTarget) return;
          lockMutation.mutate(lockTarget.id, { onSuccess: () => setLockTarget(null) });
        }}
      />
    </div>
  );
}
