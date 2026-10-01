"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRooms } from "@/features/rooms/hooks";
import { useSimulationRun } from "@/features/simulation/hooks";
import { isLiveSnapshot } from "@/features/simulation/types";
import { KpiStrip } from "@/features/simulation/components/kpi-strip";
import { SimulationControlBar } from "@/features/simulation/components/simulation-control-bar";
import { HospitalBoard } from "@/features/simulation/components/hospital-board";
import { PatientServiceMatrix } from "@/features/simulation/components/patient-service-matrix";
import type { RoomBoardEntry } from "@/features/simulation/components/room-card";
import type { MetricsSnapshot } from "@/features/simulation/types";

const EMPTY_METRICS: MetricsSnapshot = {
  simTimeMs: 0,
  counters: {
    patientsArrived: 0,
    visitsCreated: 0,
    visitsCompleted: 0,
    noShows: 0,
    stepsWaiting: 0,
    stepsInService: 0,
  },
  waitingTimeMs: { count: 0, mean: 0, median: 0, p95: 0, max: 0 },
  lengthOfStayMs: { count: 0, mean: 0, median: 0, p95: 0, max: 0 },
  serviceTimeMs: { count: 0, mean: 0, median: 0, p95: 0, max: 0 },
  throughputPerSimHour: 0,
  perRoom: {},
};

export default function SimulationRunDetailPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;
  const { data: detail, isLoading } = useSimulationRun(runId);
  const { data: allRooms } = useRooms();

  if (isLoading || !detail) {
    return <div className="p-6 text-sm text-slate-500">Đang tải...</div>;
  }

  const live = isLiveSnapshot(detail);
  const metrics = live ? detail.metrics : (detail.summary ?? EMPTY_METRICS);
  const simTimeMs = live ? detail.simTimeMs : (detail.simEndTimeMs ?? 0);
  const config = detail.config;
  const clockPolicy = config?.clockPolicy ?? "ASAP";

  const roomsById = new Map((allRooms ?? []).map((r) => [r.id, r]));
  const boardRooms: RoomBoardEntry[] = (config?.rooms ?? []).map((r) => {
    const room = roomsById.get(r.roomId);
    return {
      roomId: r.roomId,
      roomNumber: room?.roomNumber ?? `#${r.roomId}`,
      name: room?.name ?? "",
      roomType: room?.roomType.name ?? "",
    };
  });

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/simulation"
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">
          {"name" in detail ? detail.name : runId}
        </h1>
        <Badge variant="default">{detail.status}</Badge>
      </div>

      <SimulationControlBar runId={runId} status={detail.status} clockPolicy={clockPolicy} />

      <KpiStrip simTimeMs={simTimeMs} metrics={metrics} />

      <Card>
        <CardHeader>
          <CardTitle>Bảng điều khiển bệnh viện</CardTitle>
        </CardHeader>
        <CardContent>
          <HospitalBoard rooms={boardRooms} perRoom={metrics.perRoom} roomState={detail.roomState} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ma trận dịch vụ bệnh nhân</CardTitle>
          <p className="text-xs text-slate-500">Mỗi bệnh nhân một dòng; màu sắc thể hiện tiến độ và phòng hiện tại của từng bước khám.</p>
        </CardHeader>
        <CardContent>
          <PatientServiceMatrix locations={detail.patientLocations ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
