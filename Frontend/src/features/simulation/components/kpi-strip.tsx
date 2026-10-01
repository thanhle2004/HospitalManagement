import { Card, CardContent } from "@/components/ui/card";
import type { MetricsSnapshot } from "../types";

function formatSimDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}g ${minutes}p ${seconds}s`;
  if (minutes > 0) return `${minutes}p ${seconds}s`;
  return `${seconds}s`;
}

function formatMinutes(ms: number): string {
  if (ms <= 0) return "0 phút";
  const minutes = ms / 60_000;
  if (minutes < 1) return `${Math.round(ms / 1000)} giây`;
  return `${minutes.toFixed(1)} phút`;
}

interface KpiItem {
  label: string;
  value: string;
}

export function KpiStrip({ simTimeMs, metrics }: { simTimeMs: number; metrics: MetricsSnapshot }) {
  const active =
    metrics.counters.visitsCreated - metrics.counters.visitsCompleted - metrics.counters.noShows;

  const items: KpiItem[] = [
    { label: "Thời gian mô phỏng", value: formatSimDuration(simTimeMs) },
    { label: "Đang trong hệ thống", value: String(Math.max(0, active)) },
    { label: "Đang chờ", value: String(metrics.counters.stepsWaiting) },
    { label: "Đang khám", value: String(metrics.counters.stepsInService) },
    { label: "Hoàn thành", value: String(metrics.counters.visitsCompleted) },
    { label: "Không tới (no-show)", value: String(metrics.counters.noShows) },
    { label: "Chờ trung bình", value: formatMinutes(metrics.waitingTimeMs.mean) },
    {
      label: "Thông lượng",
      value: `${metrics.throughputPerSimHour.toFixed(1)} bệnh nhân/giờ`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-3">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}