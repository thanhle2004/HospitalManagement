"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSimulationRuns, useSimulationRunControls } from "@/features/simulation/hooks";
import { ScenarioFormDialog } from "@/features/simulation/components/scenario-form-dialog";
import type { SimulationRunStatus } from "@/features/simulation/types";

function statusVariant(status: SimulationRunStatus): "default" | "success" | "warning" | "destructive" | "info" {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "RUNNING":
    case "PREPARING":
    case "DRAINING":
      return "info";
    case "PAUSED":
    case "STOPPING":
      return "warning";
    case "FAILED":
      return "destructive";
    default:
      return "default";
  }
}

const STATUS_LABEL: Record<SimulationRunStatus, string> = {
  PENDING: "Chưa chạy",
  PREPARING: "Đang chuẩn bị",
  RUNNING: "Đang chạy",
  PAUSED: "Tạm dừng",
  DRAINING: "Đang hoàn tất",
  COMPLETED: "Hoàn tất",
  STOPPING: "Đang dừng",
  STOPPED: "Đã dừng",
  FAILED: "Thất bại",
};

function RowDeleteButton({ runId }: { runId: string }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { remove } = useSimulationRunControls(runId);

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setConfirmOpen(true)}>
        <Trash2 className="h-4 w-4 text-slate-400" />
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Xoá lượt mô phỏng"
        description="Toàn bộ Patient/Visit/User bác sĩ/Device tổng hợp của lượt này sẽ bị xoá vĩnh viễn. Nếu run đang chạy, hãy Dừng trước."
        confirmLabel="Xoá"
        isLoading={remove.isPending}
        onConfirm={() => remove.mutate(undefined, { onSuccess: () => setConfirmOpen(false) })}
      />
    </>
  );
}

export default function SimulationRunsPage() {
  const { data: runs, isLoading } = useSimulationRuns();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Mô phỏng luồng bệnh nhân</h1>
          <p className="text-sm text-slate-500">
            Tạo và theo dõi các lượt mô phỏng — xem docs/simulator-architecture.md
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Lượt mô phỏng mới
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-slate-500">Đang tải...</p>}
          {!isLoading && (runs?.length ?? 0) === 0 && (
            <p className="text-sm text-slate-500">Chưa có lượt mô phỏng nào.</p>
          )}
          {!isLoading && (runs?.length ?? 0) > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Chế độ</TableHead>
                  <TableHead>Seed</TableHead>
                  <TableHead>Tạo lúc</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs?.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Link
                        href={`/admin/simulation/${run.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {run.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(run.status)}>{STATUS_LABEL[run.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">{run.mode}</TableCell>
                    <TableCell className="text-slate-500">{run.seed}</TableCell>
                    <TableCell className="text-slate-500">
                      {new Date(run.createdAt).toLocaleString("vi-VN")}
                    </TableCell>
                    <TableCell>
                      <RowDeleteButton runId={run.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ScenarioFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}