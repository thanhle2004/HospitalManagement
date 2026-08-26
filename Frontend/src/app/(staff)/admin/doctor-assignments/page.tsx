"use client";

import { useState } from "react";
import { Plus, Square, Trash2 } from "lucide-react";
import {
  useDoctorAssignments,
  useEndDoctorShift,
  useDeleteDoctorAssignment,
} from "@/features/doctor-assignments/hooks";
import { DoctorAssignmentFormDialog } from "@/features/doctor-assignments/components/doctor-assignment-form-dialog";
import type { DoctorAssignment } from "@/features/doctor-assignments/types";
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isOngoing(assignment: DoctorAssignment) {
  if (!assignment.endTime) return true;
  return new Date(assignment.endTime).getTime() > Date.now();
}

export default function DoctorAssignmentsPage() {
  const assignments = useDoctorAssignments();
  const endShift = useEndDoctorShift();
  const deleteMutation = useDeleteDoctorAssignment();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DoctorAssignment | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Ca trực</h1>
          <p className="text-sm text-slate-500">Phân công bác sĩ vào phòng khám theo khung giờ</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Phân công
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bác sĩ</TableHead>
              <TableHead>Phòng</TableHead>
              <TableHead>Bắt đầu</TableHead>
              <TableHead>Kết thúc</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-24 text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500">
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {assignments.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500">
                  Chưa có ca trực nào
                </TableCell>
              </TableRow>
            )}
            {assignments.data?.map((a) => {
              const ongoing = isOngoing(a);
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-slate-900">
                    {a.doctor.fullName ?? a.doctor.email}
                  </TableCell>
                  <TableCell>
                    {a.room.roomNumber} — {a.room.name}
                  </TableCell>
                  <TableCell className="text-xs">{formatDateTime(a.startTime)}</TableCell>
                  <TableCell className="text-xs">
                    {a.endTime ? formatDateTime(a.endTime) : "Chưa xác định"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ongoing ? "success" : "default"}>
                      {ongoing ? "Đang/sẽ trực" : "Đã kết thúc"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {ongoing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Kết thúc ca sớm"
                          onClick={() => endShift.mutate(a.id)}
                          disabled={endShift.isPending}
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(a)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <DoctorAssignmentFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Xoá ca trực?"
        description="Dùng khi tạo nhầm. Nếu ca đã diễn ra thật, nên dùng 'Kết thúc ca sớm' thay vì xoá để giữ lịch sử."
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </div>
  );
}
