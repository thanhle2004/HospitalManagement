import type { SimulationPatientLocation } from "../types";
import { formatSimulationPatientName } from "../presentation";

const STATUS_STYLES: Record<string, string> = {
  LOCKED: "border-slate-200 bg-slate-50 text-slate-400",
  READY: "border-violet-200 bg-violet-50 text-violet-700",
  ASSIGNED: "border-amber-200 bg-amber-50 text-amber-700",
  CHECKED_IN: "border-cyan-200 bg-cyan-50 text-cyan-700",
  IN_PROGRESS: "border-blue-300 bg-blue-100 text-blue-800",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  SKIPPED: "border-slate-200 bg-slate-100 text-slate-500",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-700",
};

const STATUS_LABELS: Record<string, string> = {
  LOCKED: "Chưa mở",
  READY: "Sẵn sàng",
  ASSIGNED: "Đã xếp phòng",
  CHECKED_IN: "Đã check-in",
  IN_PROGRESS: "Đang khám",
  COMPLETED: "Hoàn tất",
  SKIPPED: "Bỏ qua",
  CANCELLED: "Đã huỷ",
};

interface PatientRow {
  patientId: string;
  patientName: string;
  visitId: string;
  cells: Map<number, SimulationPatientLocation>;
}

export function PatientServiceMatrix({ locations }: { locations: SimulationPatientLocation[] }) {
  if (locations.length === 0) {
    return <p className="text-sm text-slate-500">Chưa có dữ liệu bệnh nhân.</p>;
  }

  const columns = Array.from(
    locations.reduce((steps, location) => {
      if (!steps.has(location.stepDisplayOrder)) {
        steps.set(location.stepDisplayOrder, location.currentStep);
      }
      return steps;
    }, new Map<number, string>()),
  ).sort(([left], [right]) => left - right);

  const rows = Array.from(
    locations.reduce((patients, location) => {
      const existing = patients.get(location.patientId) ?? {
        patientId: location.patientId,
        patientName: location.patientName,
        visitId: location.visitId,
        cells: new Map<number, SimulationPatientLocation>(),
      };
      existing.cells.set(location.stepDisplayOrder, location);
      patients.set(location.patientId, existing);
      return patients;
    }, new Map<string, PatientRow>()).values(),
  ).sort((left, right) =>
    formatSimulationPatientName(left.patientName).localeCompare(
      formatSimulationPatientName(right.patientName),
      "vi",
      { numeric: true },
    ),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm border ${STATUS_STYLES[status]}`} />
            {label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th className="sticky left-0 z-20 min-w-36 border-b border-r border-slate-200 bg-slate-50 px-3 py-2.5 text-left font-semibold">
                Bệnh nhân
              </th>
              {columns.map(([displayOrder, stepName]) => (
                <th key={displayOrder} className="min-w-36 border-b border-r border-slate-200 px-3 py-2.5 text-center font-semibold last:border-r-0">
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">Bước {displayOrder}</span>
                  {stepName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((patient) => (
              <tr key={patient.patientId} className="group">
                <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-3 py-2 text-left font-semibold text-slate-800 group-last:border-b-0">
                  {formatSimulationPatientName(patient.patientName)}
                </th>
                {columns.map(([displayOrder]) => {
                  const cell = patient.cells.get(displayOrder);
                  if (!cell) {
                    return <td key={displayOrder} className="border-b border-r border-slate-100 bg-slate-50/40 p-1.5 last:border-r-0" />;
                  }
                  const style = STATUS_STYLES[cell.status] ?? STATUS_STYLES.LOCKED;
                  return (
                    <td key={displayOrder} className="border-b border-r border-slate-100 p-1.5 text-center last:border-r-0">
                      <div className={`rounded-md border px-2 py-2 ${style}`} title={`${STATUS_LABELS[cell.status] ?? cell.status}${cell.currentRoom ? ` · ${cell.currentRoom}` : ""}`}>
                        <span className="block font-semibold">{STATUS_LABELS[cell.status] ?? cell.status}</span>
                        <span className="mt-0.5 block text-[10px] opacity-80">{cell.currentRoom ?? "Chưa có phòng"}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
