"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { usePatientTypes, useDeletePatientType } from "@/features/patient-types/hooks";
import { PatientTypeFormDialog } from "@/features/patient-types/components/patient-type-form-dialog";
import type { PatientType } from "@/features/patient-types/types";
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

export default function PatientTypesPage() {
  const patientTypes = usePatientTypes();
  const deleteMutation = useDeletePatientType();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PatientType | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<PatientType | null>(null);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (patientType: PatientType) => {
    setEditing(patientType);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Loại bệnh nhân</h1>
          <p className="text-sm text-slate-500">Quản lý các loại bệnh nhân</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Tạo mới
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Mô tả</TableHead>
              <TableHead className="w-24 text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patientTypes.isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {patientTypes.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">
                  Chưa có loại bệnh nhân nào
                </TableCell>
              </TableRow>
            )}
            {patientTypes.data?.map((pt) => (
              <TableRow key={pt.id}>
                <TableCell>
                  <Badge variant={pt.code === "STANDARD" ? "info" : "default"}>{pt.code}</Badge>
                </TableCell>
                <TableCell className="font-medium text-slate-900">{pt.name}</TableCell>
                <TableCell>{pt.description ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(pt)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(pt)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <PatientTypeFormDialog open={formOpen} onOpenChange={setFormOpen} patientType={editing} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Xoá loại bệnh nhân?"
        description={`"${deleteTarget?.name}" sẽ bị xoá (soft-delete). Lưu ý: nếu đây là loại "STANDARD" mặc định, Patient đăng ký không chọn loại cụ thể sẽ lỗi cho tới khi có loại STANDARD khác.`}
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </div>
  );
}
