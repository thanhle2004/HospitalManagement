"use client";

import { useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Plus, Square, Trash2, UsersRound } from "lucide-react";
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

function assignmentState(assignment: DoctorAssignment, now: number) {
  if (new Date(assignment.startTime).getTime() > now) return "upcoming" as const;
  if (!assignment.endTime || new Date(assignment.endTime).getTime() > now) {
    return "active" as const;
  }
  return "completed" as const;
}

export default function DoctorAssignmentsPage() {
  const assignments = useDoctorAssignments();
  const endShift = useEndDoctorShift();
  const deleteMutation = useDeleteDoctorAssignment();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DoctorAssignment | null>(null);
  const now = assignments.dataUpdatedAt;
  const activeAssignments =
    assignments.data?.filter((item) => assignmentState(item, now) === "active") ?? [];
  const upcomingCount =
    assignments.data?.filter((item) => assignmentState(item, now) === "upcoming").length ?? 0;
  const confirmedCount = activeAssignments.filter((item) => item.roomConfirmedAt).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Phân phòng trực</h1>
          <p className="mt-1 text-sm text-slate-500">
            Admin xếp phòng trước; bác sĩ xác nhận đúng phòng khi bắt đầu ca.
          </p>
        </div>
        <Button
          className="bg-sky-700 hover:bg-sky-800 focus-visible:ring-sky-700"
          onClick={() => setFormOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Phân phòng cho bác sĩ
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-sky-100 p-2.5">
              <UsersRound className="h-5 w-5 text-sky-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Đang trong ca</p>
              <p className="text-xl font-semibold text-slate-900">{activeAssignments.length}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-green-100 p-2.5">
              <CheckCircle2 className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Đã xác nhận phòng</p>
              <p className="text-xl font-semibold text-slate-900">{confirmedCount}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-amber-100 p-2.5">
              <CalendarDays className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Ca sắp tới</p>
              <p className="text-xl font-semibold text-slate-900">{upcomingCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <Table className="min-w-[940px]">
          <TableHeader>
            <TableRow>
              <TableHead>Bác sĩ</TableHead>
              <TableHead>Phòng</TableHead>
              <TableHead>Bắt đầu</TableHead>
              <TableHead>Kết thúc</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Xác nhận phòng</TableHead>
              <TableHead className="w-24 text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500">
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {assignments.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-slate-500">
                  Chưa có ca trực nào
                </TableCell>
              </TableRow>
            )}
            {assignments.data?.map((a) => {
              const state = assignmentState(a, now);
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
                    <Badge
                      variant={state === "active" ? "success" : state === "upcoming" ? "info" : "default"}
                    >
                      {state === "active"
                        ? "Đang trực"
                        : state === "upcoming"
                          ? "Sắp tới"
                          : "Đã kết thúc"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.roomConfirmedAt ? (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-green-700">
                        <CheckCircle2 className="h-4 w-4" />
                        {formatDateTime(a.roomConfirmedAt)}
                      </div>
                    ) : state === "active" ? (
                      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                        <Clock3 className="h-4 w-4" />
                        Chờ bác sĩ xác nhận
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">Chưa xác nhận</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {state !== "completed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Kết thúc ca sớm"
                          aria-label={`Kết thúc ca của ${a.doctor.fullName ?? a.doctor.email}`}
                          onClick={() => endShift.mutate(a.id)}
                          disabled={endShift.isPending}
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Xoá ca của ${a.doctor.fullName ?? a.doctor.email}`}
                        onClick={() => setDeleteTarget(a)}
                      >
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
