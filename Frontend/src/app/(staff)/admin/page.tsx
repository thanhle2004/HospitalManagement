"use client";

import type { LucideIcon } from "lucide-react";
import { Users, Activity, DoorOpen, Stethoscope, TriangleAlert } from "lucide-react";
import { useDoctors } from "@/features/doctors/hooks";
import { useAllVisits } from "@/features/visits/hooks";
import { useAdminQueueOverview } from "@/features/admin-queue/hooks";
import { useRecentActivityLogs } from "@/features/activity-log/hooks";
import { useRooms } from "@/features/rooms/hooks";
import { useDoctorAssignments } from "@/features/doctor-assignments/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="rounded-full bg-slate-100 p-3">
          <Icon className="h-5 w-5 text-slate-700" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-2xl font-semibold text-slate-900">{isLoading ? "…" : value}</p>
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

export default function AdminDashboardPage() {
  const doctors = useDoctors();
  const visits = useAllVisits();
  const queue = useAdminQueueOverview();
  const logs = useRecentActivityLogs(5);
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

      {!isLoadingCore && uncoveredRooms.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <TriangleAlert className="h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-medium text-red-800">
              {uncoveredRooms.length} phòng đang hoạt động nhưng KHÔNG có bác sĩ trực
            </p>
            <p className="mt-1 text-sm text-red-700">
              {uncoveredRooms.map((r) => `${r.roomNumber} (${r.name})`).join(", ")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bác sĩ đang trực</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {onDutyAssignments.isLoading && <p className="text-sm text-slate-500">Đang tải...</p>}
            {onDutyAssignments.data?.length === 0 && (
              <p className="text-sm text-slate-500">Hiện không có bác sĩ nào đang trực</p>
            )}
            {onDutyAssignments.data?.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium text-slate-900">{a.doctor.fullName ?? a.doctor.email}</p>
                  <p className="text-xs text-slate-500">
                    {a.room.roomNumber} — {a.room.name}
                  </p>
                </div>
                <Badge variant="success">Đang trực</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Nhật ký hoạt động gần đây</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {logs.isLoading && <p className="text-sm text-slate-500">Đang tải...</p>}
            {logs.isError && (
              <p className="text-sm text-red-600">Không tải được nhật ký hoạt động</p>
            )}
            {logs.data && logs.data.items.length === 0 && (
              <p className="text-sm text-slate-500">Chưa có hoạt động nào được ghi nhận</p>
            )}
            {logs.data?.items.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0 last:pb-0"
              >
                <div>
                  <span className="font-medium text-slate-900">{log.action}</span>
                  <span className="text-slate-500">
                    {" "}
                    — {log.entity} #{log.entityId}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatDateTime(log.createdAt)}
                </span>
              </div>
            ))}
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
