"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useRoomTypes, useDeleteRoomType } from "@/features/room-types/hooks";
import { RoomTypeFormDialog } from "@/features/room-types/components/room-type-form-dialog";
import type { RoomType } from "@/features/room-types/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function RoomTypesPage() {
  const roomTypes = useRoomTypes();
  const deleteMutation = useDeleteRoomType();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RoomType | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<RoomType | null>(null);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (roomType: RoomType) => {
    setEditing(roomType);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Loại phòng khám</h1>
          <p className="text-sm text-slate-500">Quản lý các loại phòng khám (Khám Nội, Xét nghiệm...)</p>
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
              <TableHead>Tên</TableHead>
              <TableHead>Mô tả</TableHead>
              <TableHead>Thời gian TB (phút)</TableHead>
              <TableHead className="w-24 text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roomTypes.isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {roomTypes.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">
                  Chưa có loại phòng khám nào
                </TableCell>
              </TableRow>
            )}
            {roomTypes.data?.map((rt) => (
              <TableRow key={rt.id}>
                <TableCell className="font-medium text-slate-900">{rt.name}</TableCell>
                <TableCell>{rt.description ?? "—"}</TableCell>
                <TableCell>{rt.avgProcessTime}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(rt)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(rt)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <RoomTypeFormDialog open={formOpen} onOpenChange={setFormOpen} roomType={editing} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Xoá loại phòng khám?"
        description={`"${deleteTarget?.name}" sẽ bị xoá (soft-delete). Các phòng đang thuộc loại này không bị ảnh hưởng.`}
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </div>
  );
}
