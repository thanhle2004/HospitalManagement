"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpToLine,
  CircleAlert,
  Clock3,
  DoorOpen,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import {
  useAdminQueueOverview,
  useMoveQueueEntryAfter,
  useMoveQueueEntryToFront,
} from "@/features/admin-queue/hooks";
import type { AdminQueueEntry, AssignmentStatus } from "@/features/admin-queue/types";

const STATUS_LABEL: Record<AssignmentStatus, string> = {
  WAITING: "Đang chờ",
  CHECKED_IN: "Đã check-in",
  IN_PROGRESS: "Đang khám",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã huỷ",
};

const STATUS_BADGE: Record<
  AssignmentStatus,
  "default" | "info" | "success" | "warning" | "destructive"
> = {
  WAITING: "default",
  CHECKED_IN: "info",
  IN_PROGRESS: "success",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

interface QueueRoomGroup {
  room: AdminQueueEntry["room"];
  roomType: AdminQueueEntry["roomType"];
  entries: AdminQueueEntry[];
}

type ReorderRequest =
  | { mode: "front"; entry: AdminQueueEntry }
  | { mode: "after"; entry: AdminQueueEntry; target: AdminQueueEntry };

function waitingTime(checkedInAt: string | null) {
  if (!checkedInAt) return "Chưa ghi nhận check-in";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(checkedInAt).getTime()) / 60_000));
  if (minutes < 60) return `Chờ ${minutes} phút`;
  return `Chờ ${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}

export default function AdminQueuePage() {
  const queue = useAdminQueueOverview();
  const moveToFront = useMoveQueueEntryToFront();
  const moveAfter = useMoveQueueEntryAfter();
  const [selectedTargets, setSelectedTargets] = useState<Record<number, string>>({});
  const [reorderRequest, setReorderRequest] = useState<ReorderRequest | null>(null);

  const roomGroups = useMemo(() => {
    const groups = new Map<number, QueueRoomGroup>();
    for (const entry of queue.data ?? []) {
      const current = groups.get(entry.room.id);
      if (current) {
        current.entries.push(entry);
      } else {
        groups.set(entry.room.id, {
          room: entry.room,
          roomType: entry.roomType,
          entries: [entry],
        });
      }
    }
    return [...groups.values()].map((group) => ({
      ...group,
      entries: group.entries.sort((a, b) => {
        if (a.status === "IN_PROGRESS" && b.status !== "IN_PROGRESS") return -1;
        if (b.status === "IN_PROGRESS" && a.status !== "IN_PROGRESS") return 1;
        return a.position - b.position;
      }),
    }));
  }, [queue.data]);

  const waitingCount =
    queue.data?.filter((entry) => entry.status === "WAITING" || entry.status === "CHECKED_IN")
      .length ?? 0;
  const inProgressCount =
    queue.data?.filter((entry) => entry.status === "IN_PROGRESS").length ?? 0;
  const isReordering = moveToFront.isPending || moveAfter.isPending;

  const confirmReorder = () => {
    if (!reorderRequest) return;
    if (reorderRequest.mode === "front") {
      moveToFront.mutate(reorderRequest.entry.queueEntryId, {
        onSuccess: () => setReorderRequest(null),
      });
      return;
    }
    moveAfter.mutate(
      {
        queueEntryId: reorderRequest.entry.queueEntryId,
        targetQueueEntryId: reorderRequest.target.queueEntryId,
      },
      {
        onSuccess: () => {
          setSelectedTargets((current) => ({
            ...current,
            [reorderRequest.entry.queueEntryId]: "",
          }));
          setReorderRequest(null);
        },
      },
    );
  };

  const confirmationDescription =
    reorderRequest?.mode === "front"
      ? `Đưa “${reorderRequest.entry.patient.fullName}” lên đầu danh sách chờ của phòng ${reorderRequest.entry.room.roomNumber}?`
      : reorderRequest?.mode === "after"
        ? `Đặt “${reorderRequest.entry.patient.fullName}” ngay sau “${reorderRequest.target.patient.fullName}” tại phòng ${reorderRequest.entry.room.roomNumber}?`
        : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Giám sát hàng đợi</h1>
          <p className="mt-1 text-sm text-slate-500">
            Theo dõi toàn viện và điều chỉnh thứ tự trong trường hợp đặc biệt.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          isLoading={queue.isFetching}
          onClick={() => queue.refetch()}
        >
          <RefreshCw className="h-4 w-4" />
          Làm mới
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-slate-100 p-2">
              <DoorOpen className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Phòng có hàng đợi</p>
              <p className="text-xl font-semibold text-slate-900">{queue.isLoading ? "…" : roomGroups.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-100 p-2">
              <UsersRound className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Đang chờ</p>
              <p className="text-xl font-semibold text-slate-900">{queue.isLoading ? "…" : waitingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-green-100 p-2">
              <Activity className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Đang được khám</p>
              <p className="text-xl font-semibold text-slate-900">{queue.isLoading ? "…" : inProgressCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        Tự động cập nhật mỗi 5 giây
      </div>

      {queue.isError && (
        <Card>
          <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center">
            <CircleAlert className="h-8 w-8 text-red-600" />
            <p className="text-sm font-medium text-slate-900">Không tải được hàng đợi toàn viện</p>
            <Button variant="outline" size="sm" onClick={() => queue.refetch()}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
      )}

      {!queue.isError && !queue.isLoading && roomGroups.length === 0 && (
        <Card>
          <CardContent className="flex min-h-56 flex-col items-center justify-center p-6 text-center">
            <UsersRound className="h-9 w-9 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-800">Hiện không có bệnh nhân trong hàng đợi</p>
            <p className="mt-1 text-xs text-slate-500">Danh sách sẽ tự cập nhật khi có bệnh nhân check-in.</p>
          </CardContent>
        </Card>
      )}

      {queue.isLoading && (
        <Card>
          <CardContent className="flex min-h-56 items-center justify-center p-6 text-sm text-slate-500">
            Đang tải hàng đợi...
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {roomGroups.map((group) => (
          <Card key={group.room.id} className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between border-b border-slate-200 bg-slate-50 p-4">
              <div>
                <CardTitle className="text-base">
                  {group.room.roomNumber} · {group.room.name}
                </CardTitle>
                <p className="mt-1 text-xs text-slate-500">{group.roomType.name}</p>
              </div>
              <Badge variant="info">{group.entries.length} bệnh nhân</Badge>
            </CardHeader>
            <CardContent className="divide-y divide-slate-100 p-0">
              {group.entries.map((entry, index) => {
                const canMove = entry.status === "WAITING" || entry.status === "CHECKED_IN";
                const targetId = selectedTargets[entry.queueEntryId] ?? "";
                const target = group.entries.find(
                  (candidate) => candidate.queueEntryId === Number(targetId),
                );

                return (
                  <div key={entry.queueEntryId} className="space-y-3 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-900">{entry.patient.fullName}</p>
                          <Badge variant={STATUS_BADGE[entry.status]}>{STATUS_LABEL[entry.status]}</Badge>
                          {entry.source === "MANUAL_ADMIN" && <Badge variant="warning">Đã điều chỉnh</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {entry.patient.phone} · {entry.roomType.name}
                        </p>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                          <Clock3 className="h-3.5 w-3.5" />
                          {waitingTime(entry.checkedInAt)}
                        </p>
                      </div>
                    </div>

                    {canMove && group.entries.length > 1 && (
                      <div className="flex flex-col gap-2 rounded-lg bg-slate-50 p-2 sm:flex-row">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isReordering || index === 0}
                          onClick={() => setReorderRequest({ mode: "front", entry })}
                        >
                          <ArrowUpToLine className="h-4 w-4" />
                          Lên đầu
                        </Button>
                        <div className="min-w-0 flex-1">
                          <Select
                            aria-label={`Chọn vị trí mới cho ${entry.patient.fullName}`}
                            value={targetId}
                            disabled={isReordering}
                            className="h-8 text-xs"
                            onChange={(event) =>
                              setSelectedTargets((current) => ({
                                ...current,
                                [entry.queueEntryId]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Đặt ngay sau...</option>
                            {group.entries
                              .filter((candidate) => candidate.queueEntryId !== entry.queueEntryId)
                              .map((candidate) => (
                                <option key={candidate.queueEntryId} value={candidate.queueEntryId}>
                                  {candidate.patient.fullName}
                                </option>
                              ))}
                          </Select>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!target || isReordering}
                          onClick={() =>
                            target && setReorderRequest({ mode: "after", entry, target })
                          }
                        >
                          <ArrowDownToLine className="h-4 w-4" />
                          Di chuyển
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      <ConfirmDialog
        open={!!reorderRequest}
        onOpenChange={(nextOpen) => !nextOpen && setReorderRequest(null)}
        title="Xác nhận đổi thứ tự hàng đợi"
        description={confirmationDescription}
        confirmLabel="Đổi thứ tự"
        variant="default"
        isLoading={isReordering}
        onConfirm={confirmReorder}
      />
    </div>
  );
}
