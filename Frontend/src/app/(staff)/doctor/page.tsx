"use client";

import {
  Activity,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  DoorOpen,
  MapPin,
  Play,
  RefreshCw,
  Stethoscope,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/features/auth/store";
import {
  useCompleteExam,
  useConfirmDutyRoom,
  useDoctorDutyAssignments,
  useDoctorQueue,
  useStartExam,
} from "@/features/doctor-workspace/hooks";
import type { DoctorQueueEntry } from "@/features/doctor-workspace/types";

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function waitingTime(value: string | null, now: number) {
  if (!value) return "Vừa check-in";
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(value).getTime()) / 60_000),
  );
  if (minutes < 60) return `Đã chờ ${minutes} phút`;
  return `Đã chờ ${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}

function patientCode(entry: DoctorQueueEntry) {
  return `BN-${entry.patient.id.slice(0, 6).toUpperCase()}`;
}

export default function DoctorWorkspacePage() {
  const user = useAuthStore((state) => state.user);
  const dutyAssignments = useDoctorDutyAssignments();
  const confirmRoom = useConfirmDutyRoom();
  const startExam = useStartExam();
  const completeExam = useCompleteExam();

  const now = dutyAssignments.dataUpdatedAt;
  const activeAssignment = dutyAssignments.data?.find((assignment) => {
    const started = new Date(assignment.startTime).getTime() <= now;
    const notEnded =
      !assignment.endTime || new Date(assignment.endTime).getTime() > now;
    return started && notEnded;
  });
  const upcomingAssignments =
    dutyAssignments.data?.filter(
      (assignment) => new Date(assignment.startTime).getTime() > now,
    ) ?? [];
  const roomIsConfirmed = Boolean(activeAssignment?.roomConfirmedAt);
  const queue = useDoctorQueue(roomIsConfirmed);

  const currentExam = queue.data?.find((entry) => entry.status === "IN_PROGRESS");
  const waitingEntries =
    queue.data?.filter(
      (entry) => entry.status === "CHECKED_IN" || entry.status === "WAITING",
    ) ?? [];
  const nextPatient = waitingEntries.find((entry) => entry.status === "CHECKED_IN");

  if (dutyAssignments.isLoading) {
    return (
      <Card>
        <CardContent className="flex min-h-80 items-center justify-center p-6 text-sm text-slate-500">
          Đang kiểm tra lịch trực của bác sĩ...
        </CardContent>
      </Card>
    );
  }

  if (dutyAssignments.isError) {
    return (
      <Card>
        <CardContent className="flex min-h-80 flex-col items-center justify-center gap-3 p-6 text-center">
          <CircleAlert className="h-9 w-9 text-red-600" />
          <p className="font-medium text-slate-900">Không tải được lịch trực</p>
          <Button variant="outline" onClick={() => dutyAssignments.refetch()}>
            <RefreshCw className="h-4 w-4" />
            Thử lại
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!activeAssignment) {
    return (
      <div className="space-y-5">
        <div>
          <p className="text-sm font-medium text-sky-700">Khu vực bác sĩ</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Xin chào, {user?.profile?.fullName ?? user?.email}
          </h1>
        </div>
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-sky-600" />
          <CardContent className="flex min-h-72 flex-col items-center justify-center p-6 text-center">
            <div className="rounded-full bg-sky-100 p-4">
              <CalendarClock className="h-9 w-9 text-sky-700" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-900">
              Hiện chưa đến ca trực
            </h2>
            {upcomingAssignments[0] ? (
              <div className="mt-3 rounded-xl bg-slate-50 px-5 py-4 text-sm text-slate-600">
                <p className="font-medium text-slate-900">
                  Ca tiếp theo: Phòng {upcomingAssignments[0].room.roomNumber}
                </p>
                <p className="mt-1">{formatDateTime(upcomingAssignments[0].startTime)}</p>
              </div>
            ) : (
              <p className="mt-2 max-w-md text-sm text-slate-500">
                Admin chưa phân phòng trực. Hàng đợi sẽ được mở khi ca trực bắt đầu.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!roomIsConfirmed) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <p className="text-sm font-medium text-sky-700">Xác nhận ca trực</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">
            Chào bác sĩ {user?.profile?.fullName ?? user?.email}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Vui lòng đối chiếu biển phòng trước khi bắt đầu tiếp nhận bệnh nhân.
          </p>
        </div>

        <Card className="overflow-hidden border-sky-200 shadow-md">
          <div className="bg-sky-700 px-5 py-4 text-white sm:px-7">
            <div className="flex items-center gap-2 text-sm font-medium text-sky-100">
              <MapPin className="h-4 w-4" />
              Phòng trực được Admin phân công
            </div>
            <p className="mt-2 text-3xl font-bold sm:text-4xl">
              Phòng {activeAssignment.room.roomNumber}
            </p>
            <p className="mt-1 text-sm text-sky-100">{activeAssignment.room.name}</p>
          </div>
          <CardContent className="space-y-5 p-5 sm:p-7">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Bắt đầu ca
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {formatDateTime(activeAssignment.startTime)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Kết thúc dự kiến
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {activeAssignment.endTime
                    ? formatDateTime(activeAssignment.endTime)
                    : "Chưa xác định"}
                </p>
              </div>
            </div>

            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <p>
                Khi bấm xác nhận, bác sĩ xác nhận mình đang có mặt tại đúng phòng
                <strong> {activeAssignment.room.roomNumber}</strong>. Hệ thống sẽ mở hàng đợi
                của phòng này.
              </p>
            </div>

            <Button
              size="lg"
              className="w-full bg-sky-700 hover:bg-sky-800 focus-visible:ring-sky-700"
              isLoading={confirmRoom.isPending}
              onClick={() => confirmRoom.mutate(activeAssignment.id)}
            >
              <CheckCircle2 className="h-5 w-5" />
              Tôi đang ở đúng phòng {activeAssignment.room.roomNumber}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-950">
              Phòng {activeAssignment.room.roomNumber}
            </h1>
            <Badge variant="success">Đã xác nhận có mặt</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {activeAssignment.room.name} · Ca bắt đầu lúc {formatTime(activeAssignment.startTime)}
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
            <div className="rounded-xl bg-sky-100 p-2.5">
              <DoorOpen className="h-5 w-5 text-sky-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Phòng trực</p>
              <p className="font-semibold text-slate-900">
                {activeAssignment.room.roomNumber}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-amber-100 p-2.5">
              <UsersRound className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Đang chờ</p>
              <p className="font-semibold text-slate-900">{waitingEntries.length} bệnh nhân</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-xl bg-green-100 p-2.5">
              <Activity className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Trạng thái</p>
              <p className="font-semibold text-slate-900">
                {currentExam ? "Đang khám" : "Sẵn sàng"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {queue.isError && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3 text-sm text-red-700">
              <CircleAlert className="h-5 w-5" />
              Không tải được hàng đợi của phòng trực.
            </div>
            <Button variant="outline" size="sm" onClick={() => queue.refetch()}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <Card className="overflow-hidden border-sky-200">
          <CardHeader className="border-b border-slate-100 bg-sky-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">
                  {currentExam ? "Đang khám" : "Bệnh nhân tiếp theo"}
                </p>
                <CardTitle className="mt-1 text-lg">
                  {currentExam?.patient.fullName ?? nextPatient?.patient.fullName ?? "Chưa có bệnh nhân"}
                </CardTitle>
              </div>
              <div className="rounded-full bg-white p-3 shadow-sm">
                <Stethoscope className="h-6 w-6 text-sky-700" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5">
            {queue.isLoading ? (
              <p className="py-10 text-center text-sm text-slate-500">Đang tải hàng đợi...</p>
            ) : currentExam || nextPatient ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Mã bệnh nhân</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {patientCode(currentExam ?? nextPatient!)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Dịch vụ / phòng chuyên môn</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {(currentExam ?? nextPatient)?.roomType.name}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Số điện thoại</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {(currentExam ?? nextPatient)?.patient.phone}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">Thời gian chờ</p>
                    <p className="mt-1 font-semibold text-slate-900">
                      {waitingTime(
                        (currentExam ?? nextPatient)?.checkedInAt ?? null,
                        queue.dataUpdatedAt || now,
                      )}
                    </p>
                  </div>
                </div>

                {currentExam ? (
                  <Button
                    size="lg"
                    className="mt-5 w-full bg-green-700 hover:bg-green-800 focus-visible:ring-green-700"
                    isLoading={completeExam.isPending}
                    onClick={() => completeExam.mutate(currentExam.visitAssignmentId)}
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Hoàn thành lượt khám
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="mt-5 w-full bg-sky-700 hover:bg-sky-800 focus-visible:ring-sky-700"
                    isLoading={startExam.isPending}
                    onClick={() => nextPatient && startExam.mutate(nextPatient.visitAssignmentId)}
                  >
                    <Play className="h-5 w-5" />
                    Bắt đầu khám
                  </Button>
                )}
              </>
            ) : (
              <div className="flex min-h-52 flex-col items-center justify-center text-center">
                <UserRound className="h-9 w-9 text-slate-300" />
                <p className="mt-3 font-medium text-slate-800">Chưa có bệnh nhân chờ khám</p>
                <p className="mt-1 text-sm text-slate-500">
                  Danh sách sẽ tự cập nhật khi bệnh nhân check-in.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between border-b border-slate-100 p-5">
            <div>
              <CardTitle className="text-base">Hàng đợi của phòng</CardTitle>
              <p className="mt-1 text-xs text-slate-500">Tự động cập nhật mỗi 5 giây</p>
            </div>
            <Badge variant="info">{waitingEntries.length} đang chờ</Badge>
          </CardHeader>
          <CardContent className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto p-0">
            {waitingEntries.length === 0 && (
              <p className="p-8 text-center text-sm text-slate-500">Hàng đợi đang trống</p>
            )}
            {waitingEntries.map((entry, index) => (
              <div key={entry.queueEntryId} className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-800">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{entry.patient.fullName}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    {waitingTime(entry.checkedInAt, queue.dataUpdatedAt || now)}
                  </p>
                </div>
                <Badge variant={entry.status === "CHECKED_IN" ? "info" : "default"}>
                  {entry.status === "CHECKED_IN" ? "Sẵn sàng" : "Đang chờ"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
