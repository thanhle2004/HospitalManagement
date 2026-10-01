import { Play, Pause, Square, SkipForward, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { SimulationRunStatus, SimulationSpeed } from "../types";
import { useSimulationRunControls } from "../hooks";

const SPEEDS: SimulationSpeed[] = [1, 2, 5, 10, 50];

export function SimulationControlBar({
  runId,
  status,
  clockPolicy,
}: {
  runId: string;
  status: SimulationRunStatus;
  clockPolicy: "ASAP" | "PACED" | "STEP";
}) {
  const controls = useSimulationRunControls(runId);

  const notStarted = status === "PENDING";
  const isRunning = status === "RUNNING";
  const isPaused = status === "PAUSED";
  const isFinished =
    status === "COMPLETED" || status === "STOPPED" || status === "FAILED";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-3">
      {notStarted && (
        <Button
          size="sm"
          onClick={() => controls.start.mutate()}
          isLoading={controls.start.isPending}
        >
          <Play className="h-4 w-4" /> Bắt đầu
        </Button>
      )}

      {clockPolicy !== "ASAP" && isRunning && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => controls.pause.mutate()}
          isLoading={controls.pause.isPending}
        >
          <Pause className="h-4 w-4" /> Tạm dừng
        </Button>
      )}

      {clockPolicy !== "ASAP" && isPaused && (
        <Button
          size="sm"
          onClick={() => controls.resume.mutate()}
          isLoading={controls.resume.isPending}
        >
          <Play className="h-4 w-4" /> Tiếp tục
        </Button>
      )}

      {clockPolicy === "STEP" && (isRunning || isPaused) && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => controls.step.mutate()}
          isLoading={controls.step.isPending}
        >
          <SkipForward className="h-4 w-4" /> Bước tiếp theo
        </Button>
      )}

      {(isRunning || isPaused) && (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => controls.stop.mutate()}
          isLoading={controls.stop.isPending}
        >
          <Square className="h-4 w-4" /> Dừng hẳn
        </Button>
      )}

      {clockPolicy === "PACED" && (isRunning || isPaused) && (
        <div className="flex items-center gap-2">
          <RotateCw className="h-4 w-4 text-slate-400" />
          <Select
            className="h-8 w-24"
            defaultValue="1"
            disabled={controls.setSpeed.isPending}
            onChange={(e) => controls.setSpeed.mutate(Number(e.target.value) as SimulationSpeed)}
          >
            {SPEEDS.map((speed) => (
              <option key={speed} value={speed}>
                {speed}x
              </option>
            ))}
          </Select>
        </div>
      )}

      {isFinished && (
        <p className="text-sm text-slate-500">
          Lượt chạy đã kết thúc —{" "}
          {status === "COMPLETED" ? "hoàn tất" : status === "STOPPED" ? "đã dừng" : "thất bại"}.
        </p>
      )}
    </div>
  );
}