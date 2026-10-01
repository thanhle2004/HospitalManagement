import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { RoomMetrics, SimulationRoomState } from "../types";
import { formatEstimatedWaitingSeconds, formatSimulationPatientName } from "../presentation";

export interface RoomBoardEntry {
  roomId: number;
  roomNumber: string;
  name: string;
  roomType: string;
}

function utilisationVariant(pct: number): "success" | "warning" | "destructive" | "default" {
  if (pct >= 90) return "destructive";
  if (pct >= 60) return "warning";
  if (pct > 0) return "success";
  return "default";
}

export function RoomCard({ room, metrics, state }: { room: RoomBoardEntry; metrics: RoomMetrics | undefined; state?: SimulationRoomState }) {
  const m = metrics ?? {
    waitingTimeMs: { count: 0, mean: 0, median: 0, p95: 0, max: 0 },
    serviceTimeMs: { count: 0, mean: 0, median: 0, p95: 0, max: 0 },
    utilisationPct: 0,
    patientsServed: 0,
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between border-b border-slate-200 bg-slate-50 p-3">
        <div>
          <CardTitle className="text-sm">{room.roomNumber} · {room.name}</CardTitle>
          <p className="text-xs text-slate-500">{state?.roomType ?? room.roomType}</p>
        </div>
        <Badge variant={utilisationVariant(m.utilisationPct)}>
          {state?.roomStatus === "ACTIVE" ? (state.currentPatient ? "IN SERVICE" : "AVAILABLE") : state?.roomStatus ?? "UNKNOWN"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 p-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div><p className="text-slate-500">Đang khám</p><p className="font-medium text-slate-900">{state?.examiningCount ?? 0}</p></div>
          <div><p className="text-slate-500">Đang chờ</p><p className="font-medium text-slate-900">{state?.waitingCount ?? 0}</p></div>
          <div><p className="text-slate-500">Thời gian TB</p><p className="font-medium text-slate-900">{state ? `${state.avgProcessTimeSeconds} giây` : "—"}</p></div>
          <div><p className="text-slate-500">ETA chờ</p><p className="font-medium text-slate-900">{formatEstimatedWaitingSeconds(state?.estimatedWaitingSeconds ?? 0)}</p></div>
        </div>
        <div className="border-t border-slate-100 pt-2">
          <p className="text-slate-500">Hiện tại</p>
          {state?.currentPatient ? (
            <p className="font-medium text-slate-900">
              {formatSimulationPatientName(state.currentPatient.patientName)} · {state.currentPatient.currentStep} · {state.currentPatient.status}
            </p>
          ) : <p className="text-slate-400">Không có bệnh nhân</p>}
        </div>
        <div className="border-t border-slate-100 pt-2">
          <p className="text-slate-500">Hàng đợi</p>
          {state?.queue.length ? (
            <ol className="list-inside list-decimal text-slate-700">
              {state.queue.map((patient) => <li key={patient.visitStepId}>{formatSimulationPatientName(patient.patientName)} · {patient.currentStep}</li>)}
            </ol>
          ) : <p className="text-slate-400">Trống</p>}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
        <div>
          <p className="text-slate-500">Đã phục vụ</p>
          <p className="font-medium text-slate-900">{m.patientsServed}</p>
        </div>
        <div>
          <p className="text-slate-500">Chờ trung bình</p>
          <p className="font-medium text-slate-900">
            {m.waitingTimeMs.count > 0 ? `${Math.round(m.waitingTimeMs.mean / 1000)}s` : "—"}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Khám trung bình</p>
          <p className="font-medium text-slate-900">
            {m.serviceTimeMs.count > 0 ? `${Math.round(m.serviceTimeMs.mean / 1000)}s` : "—"}
          </p>
        </div>
        <div>
          <p className="text-slate-500">P95 chờ</p>
          <p className="font-medium text-slate-900">
            {m.waitingTimeMs.count > 0 ? `${Math.round(m.waitingTimeMs.p95 / 1000)}s` : "—"}
          </p>
        </div>
        </div>
      </CardContent>
    </Card>
  );
}
