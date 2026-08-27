"use client";

import { FormEvent, useState } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, Eye, Filter, ScrollText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActivityLogDetailDialog } from "@/features/activity-log/components/activity-log-detail-dialog";
import { useActivityLogs } from "@/features/activity-log/hooks";
import type { ActivityLogItem } from "@/features/activity-log/types";

const PAGE_SIZE = 20;

const ACTION_LABEL: Record<string, string> = {
  ROOM_QUEUE_MOVE_TO_FRONT: "Đưa bệnh nhân lên đầu hàng đợi",
  ROOM_QUEUE_MOVE_AFTER: "Đổi vị trí hàng đợi",
  PATIENT_TYPE_UPDATED: "Đổi phân loại bệnh nhân",
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActivityLogsPage() {
  const [draftEntity, setDraftEntity] = useState("");
  const [draftEntityId, setDraftEntityId] = useState("");
  const [draftUserId, setDraftUserId] = useState("");
  const [filters, setFilters] = useState({ entity: "", entityId: "", userId: "" });
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);

  const logs = useActivityLogs({
    entity: filters.entity || undefined,
    entityId: filters.entityId || undefined,
    userId: filters.userId || undefined,
    page,
    limit: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil((logs.data?.total ?? 0) / PAGE_SIZE));
  const hasFilters = !!filters.entity || !!filters.entityId || !!filters.userId;

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    setFilters({
      entity: draftEntity.trim(),
      entityId: draftEntityId.trim(),
      userId: draftUserId.trim(),
    });
    setPage(1);
  };

  const clearFilters = () => {
    setDraftEntity("");
    setDraftEntityId("");
    setDraftUserId("");
    setFilters({ entity: "", entityId: "", userId: "" });
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Nhật ký hoạt động</h1>
        <p className="mt-1 text-sm text-slate-500">
          Theo dõi các thao tác quản trị quan trọng và dữ liệu audit liên quan.
        </p>
      </div>

      <Card>
        <CardContent className="flex items-center gap-3 p-5">
          <div className="rounded-xl bg-indigo-100 p-3">
            <ScrollText className="h-6 w-6 text-indigo-700" />
          </div>
          <div>
            <p className="text-xs text-slate-500">{hasFilters ? "Bản ghi phù hợp" : "Tổng bản ghi audit"}</p>
            <p className="text-2xl font-semibold text-slate-900">
              {logs.isLoading ? "…" : logs.data?.total ?? 0}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <form onSubmit={applyFilters} className="border-b border-slate-200 p-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <Input
              value={draftEntity}
              onChange={(event) => setDraftEntity(event.target.value)}
              placeholder="Đối tượng, VD: Patient"
              aria-label="Lọc theo đối tượng"
            />
            <Input
              value={draftEntityId}
              onChange={(event) => setDraftEntityId(event.target.value)}
              placeholder="Mã đối tượng"
              aria-label="Lọc theo mã đối tượng"
            />
            <Input
              value={draftUserId}
              onChange={(event) => setDraftUserId(event.target.value)}
              placeholder="UUID người thực hiện"
              aria-label="Lọc theo người thực hiện"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit">
              <Filter className="h-4 w-4" />
              Áp dụng bộ lọc
            </Button>
            {hasFilters && (
              <Button type="button" variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4" />
                Xoá bộ lọc
              </Button>
            )}
          </div>
        </form>

        {logs.isError ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center">
            <CircleAlert className="h-8 w-8 text-red-600" />
            <p className="text-sm font-medium text-slate-900">Không tải được nhật ký hoạt động</p>
            <Button variant="outline" size="sm" onClick={() => logs.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Hoạt động</TableHead>
                <TableHead>Đối tượng</TableHead>
                <TableHead>Người thực hiện</TableHead>
                <TableHead className="w-24 text-right">Chi tiết</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-slate-500">
                    Đang tải nhật ký...
                  </TableCell>
                </TableRow>
              )}
              {!logs.isLoading && logs.data?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-slate-500">
                    {hasFilters ? "Không có bản ghi phù hợp bộ lọc" : "Chưa có hoạt động nào được ghi nhận"}
                  </TableCell>
                </TableRow>
              )}
              {logs.data?.items.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(log.createdAt)}</TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-900">{ACTION_LABEL[log.action] ?? log.action}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">{log.action}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{log.entity}</Badge>
                    <p className="mt-1 max-w-48 truncate font-mono text-xs text-slate-500" title={log.entityId}>
                      {log.entityId}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-slate-600">
                      {log.userId ? `#${log.userId.slice(0, 8)}` : "Hệ thống"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Xem chi tiết nhật ký ${log.id}`}
                        title="Xem chi tiết"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!logs.isError && (logs.data?.total ?? 0) > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-slate-500">
              Trang {page}/{totalPages} · {logs.data?.total ?? 0} bản ghi
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || logs.isFetching}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Trang trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || logs.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Trang sau
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ActivityLogDetailDialog
        log={selectedLog}
        open={!!selectedLog}
        onOpenChange={(nextOpen) => !nextOpen && setSelectedLog(null)}
      />
    </div>
  );
}
