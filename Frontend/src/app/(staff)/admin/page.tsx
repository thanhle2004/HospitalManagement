"use client";

import Link from "next/link";
import { useRef } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Stethoscope,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useDoctors } from "@/features/doctors/hooks";
import { useAllVisits } from "@/features/visits/hooks";
import { useAdminQueueOverview } from "@/features/admin-queue/hooks";
import { useRecentActivityLogs } from "@/features/activity-log/hooks";
import { useRooms } from "@/features/rooms/hooks";
import type { Room } from "@/features/rooms/types";
import { useDoctorAssignments } from "@/features/doctor-assignments/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function StatCard({
  icon: Icon,
  label,
  value,
  isLoading,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  isLoading: boolean;
}) {
  return (
    <Card className="min-w-[220px] flex-none snap-start sm:min-w-0">
      <CardContent className="flex items-center gap-3 p-4 sm:p-5">
        <div className="rounded-xl bg-slate-100 p-2.5">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-0.5 text-xl font-semibold text-slate-900">
            {isLoading ? "…" : value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function UncoveredRoomsAlert({ rooms }: { rooms: Room[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollRooms(direction: -1 | 1) {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    scroller.scrollBy({
      left: direction * Math.max(280, scroller.clientWidth * 0.8),
      behavior: "smooth",
    });
  }

  return (
    <section
      aria-labelledby="uncovered-rooms-title"
      className="overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-amber-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-xl bg-amber-100 p-2.5">
            <TriangleAlert aria-hidden="true" className="h-5 w-5 text-amber-700" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="uncovered-rooms-title" className="text-sm font-semibold text-slate-900">
                Phòng chưa có bác sĩ trực
              </h2>
              <Badge variant="warning">{rooms.length} phòng cần xử lý</Badge>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">
              Các phòng dưới đây đang hoạt động nhưng chưa được bố trí bác sĩ. Cuộn ngang để xem
              toàn bộ danh sách.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          <Button
            aria-label="Xem các phòng trước"
            className="h-8 w-8 border-amber-200 text-amber-800 hover:bg-amber-100"
            onClick={() => scrollRooms(-1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </Button>
          <Button
            aria-label="Xem các phòng tiếp theo"
            className="h-8 w-8 border-amber-200 text-amber-800 hover:bg-amber-100"
            onClick={() => scrollRooms(1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        aria-label="Danh sách phòng chưa có bác sĩ trực"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 py-4 sm:px-5"
        tabIndex={0}
      >
        {rooms.map((room) => (
          <article
            key={room.id}
            className="min-w-[82%] snap-start rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-colors hover:border-amber-300 sm:min-w-[280px]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="rounded-lg bg-slate-100 p-2">
                <DoorOpen aria-hidden="true" className="h-4 w-4 text-slate-700" />
              </div>
              <Badge variant="destructive">Chưa có bác sĩ</Badge>
            </div>

            <p className="mt-4 text-base font-semibold text-slate-900">Phòng {room.roomNumber}</p>
            <p className="mt-0.5 truncate text-sm text-slate-600" title={room.name}>
              {room.name}
            </p>
            <p className="mt-3 text-xs text-slate-500">Loại phòng</p>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-700" title={room.roomType.name}>
              {room.roomType.name}
            </p>

            <Link
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 transition-colors hover:text-sky-900"
              href="/admin/doctor-assignments"
            >
              Phân bác sĩ trực
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function AdminDashboardPage() {
  const doctors = useDoctors();
  const visits = useAllVisits();
  const queue = useAdminQueueOverview();
  const logs = useRecentActivityLogs(12);
  const rooms = useRooms();
  // activeOnly=true — chỉ lấy ca trực CÒN HIỆU LỰC ngay lúc này (không lấy ca đã kết thúc/tương lai)
  const onDutyAssignments = useDoctorAssignments({ activeOnly: true });

  const visitsToday = visits.data?.filter((v) => isToday(v.createdAt)).length ?? 0;

  // RoomQueueEntry gộp cả "đang chờ" lẫn "đang khám" — tách bằng field status
  // (chỉ dequeue lúc HOÀN THÀNH khám, không phải lúc bắt đầu — xem ghi chú backend)
  const inExamCount = queue.data?.filter((e) => e.status === "IN_PROGRESS").length ?? 0;

  const activeRoomsList = rooms.data?.filter((r) => r.status === "ACTIVE") ?? [];
  const activeRoomsCount = activeRoomsList.length;

  const onDutyCount = onDutyAssignments.data?.length ?? 0;

  // Cảnh báo: phòng đang ACTIVE nhưng không có bác sĩ nào đang trực che phủ
  const coveredRoomIds = new Set((onDutyAssignments.data ?? []).map((a) => a.room.id));
  const uncoveredRooms = activeRoomsList.filter((r) => !coveredRoomIds.has(r.id));

  const isLoadingCore = rooms.isLoading || onDutyAssignments.isLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Tổng quan hệ thống</h1>
        <p className="text-sm text-slate-500">Số liệu thời gian thực</p>
      </div>

      {!isLoadingCore && uncoveredRooms.length > 0 && <UncoveredRoomsAlert rooms={uncoveredRooms} />}

      <div
        aria-label="Chỉ số tổng quan"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-4"
        tabIndex={0}
      >
        <StatCard
          icon={Users}
          label="Bệnh nhân khám hôm nay"
          value={visitsToday}
          isLoading={visits.isLoading}
        />
        <StatCard
          icon={Activity}
          label="Đang được khám"
          value={inExamCount}
          isLoading={queue.isLoading}
        />
        <StatCard
          icon={DoorOpen}
          label="Phòng đang hoạt động"
          value={activeRoomsCount}
          isLoading={rooms.isLoading}
        />
        <StatCard
          icon={Stethoscope}
          label="Bác sĩ đang trực"
          value={onDutyCount}
          isLoading={onDutyAssignments.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between border-b border-slate-100 p-5">
            <CardTitle>Bác sĩ đang trực</CardTitle>
            <Badge>{onDutyAssignments.data?.length ?? 0} bác sĩ</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {onDutyAssignments.isLoading && (
              <p className="p-5 text-sm text-slate-500">Đang tải...</p>
            )}
            {onDutyAssignments.data?.length === 0 && (
              <p className="p-5 text-sm text-slate-500">Hiện không có bác sĩ nào đang trực</p>
            )}
            {onDutyAssignments.data && onDutyAssignments.data.length > 0 && (
              <div
                aria-label="Danh sách bác sĩ đang trực"
                className="max-h-[340px] overflow-y-auto overscroll-contain px-5 [scrollbar-gutter:stable]"
                tabIndex={0}
              >
                {onDutyAssignments.data.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 text-sm last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {a.doctor.fullName ?? a.doctor.email}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {a.room.roomNumber} — {a.room.name}
                      </p>
                    </div>
                    <Badge className="shrink-0" variant={a.roomConfirmedAt ? "success" : "warning"}>
                      {a.roomConfirmedAt ? "Đã xác nhận" : "Chờ xác nhận"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between border-b border-slate-100 p-5">
            <CardTitle>Nhật ký hoạt động gần đây</CardTitle>
            <Badge>{logs.data?.items.length ?? 0} hoạt động</Badge>
          </CardHeader>
          <CardContent className="p-0">
            {logs.isLoading && <p className="p-5 text-sm text-slate-500">Đang tải...</p>}
            {logs.isError && (
              <p className="p-5 text-sm text-red-600">Không tải được nhật ký hoạt động</p>
            )}
            {logs.data && logs.data.items.length === 0 && (
              <p className="p-5 text-sm text-slate-500">Chưa có hoạt động nào được ghi nhận</p>
            )}
            {logs.data && logs.data.items.length > 0 && (
              <div
                aria-label="Danh sách nhật ký hoạt động"
                className="max-h-[340px] overflow-y-auto overscroll-contain px-5 [scrollbar-gutter:stable]"
                tabIndex={0}
              >
                {logs.data.items.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between gap-4 border-b border-slate-100 py-3 text-sm last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{log.action}</p>
                      <p className="truncate text-xs text-slate-500">
                        {log.entity} #{log.entityId}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatDateTime(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tổng số Doctor trong hệ thống (không phải "đang trực") — giữ lại cho ngữ cảnh quản lý tài khoản */}
      <p className="text-xs text-slate-400">
        Tổng số tài khoản Doctor trong hệ thống: {doctors.isLoading ? "…" : doctors.data?.length ?? 0}
      </p>
    </div>
  );
}
