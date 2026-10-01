"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { simulationApi } from "./api";
import { ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast-store";
import { isLiveSnapshot, type CreateSimulationRunPayload, type SimulationSpeed } from "./types";

const LIST_KEY = ["simulation-runs"] as const;
const DETAIL_KEY = (id: string) => ["simulation-runs", id] as const;
const VIOLATIONS_KEY = (id: string) => ["simulation-runs", id, "violations"] as const;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/** Danh sách run — không cần poll nhanh, danh sách ít thay đổi so với 1 run đang chạy. */
export function useSimulationRuns() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: simulationApi.list,
    refetchInterval: 10_000,
  });
}

/**
 * Chi tiết + trạng thái 1 run. Đây là nguồn cập nhật "trực tiếp" DUY NHẤT
 * hiện tại (xem socket.ts) — poll nhanh (1s) trong lúc còn khả năng đang
 * chạy/tạm dừng, giãn ra khi đã kết thúc hẳn (không còn gì đổi nữa).
 */
export function useSimulationRun(id: string | null) {
  return useQuery({
    queryKey: id ? DETAIL_KEY(id) : ["simulation-runs", "none"],
    queryFn: () => simulationApi.detail(id as string),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      const stillGoing =
        !status || status === "PENDING" || status === "PREPARING" || status === "RUNNING" ||
        status === "PAUSED" || status === "DRAINING" || status === "STOPPING";
      return stillGoing ? 1_000 : false;
    },
  });
}

export function useSimulationViolations(id: string | null) {
  return useQuery({
    queryKey: id ? VIOLATIONS_KEY(id) : ["simulation-runs", "none", "violations"],
    queryFn: () => simulationApi.violations(id as string),
    enabled: !!id,
    refetchInterval: 5_000,
  });
}

export function useCreateSimulationRun() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSimulationRunPayload) => simulationApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
    onError: (error) => toast.error(errorMessage(error, "Không tạo được lượt mô phỏng")),
  });
}

export function useCompareSimulationRuns() {
  return useMutation({
    mutationFn: (payload: Omit<CreateSimulationRunPayload, "mode">) =>
      simulationApi.compare(payload),
    onError: (error) =>
      toast.error(errorMessage(error, "So sánh LOCKSTEP/CONCURRENT thất bại")),
  });
}

/** start/stop/pause/resume/step/speed — gộp chung 1 hook vì đều thao tác
 * trên CÙNG 1 run và đều chỉ cần invalidate lại DETAIL_KEY sau khi thành công. */
export function useSimulationRunControls(id: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: DETAIL_KEY(id) });

  const start = useMutation({
    mutationFn: () => simulationApi.start(id),
    onSuccess: () => {
      invalidate();
      toast.success("Đã bắt đầu chạy mô phỏng");
    },
    onError: (error) => toast.error(errorMessage(error, "Không bắt đầu được")),
  });
  const stop = useMutation({
    mutationFn: () => simulationApi.stop(id),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error, "Không dừng được")),
  });
  const pause = useMutation({
    mutationFn: () => simulationApi.pause(id),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error, "Không tạm dừng được")),
  });
  const resume = useMutation({
    mutationFn: () => simulationApi.resume(id),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error, "Không tiếp tục được")),
  });
  const step = useMutation({
    mutationFn: () => simulationApi.step(id),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error, "Không thực hiện được bước tiếp theo")),
  });
  const setSpeed = useMutation({
    mutationFn: (speed: SimulationSpeed) => simulationApi.setSpeed(id, speed),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error, "Không đổi được tốc độ")),
  });
  const remove = useMutation({
    mutationFn: () => simulationApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
      toast.success("Đã xoá lượt mô phỏng");
    },
    onError: (error) => toast.error(errorMessage(error, "Không xoá được")),
  });

  return { start, stop, pause, resume, step, setSpeed, remove };
}

export { isLiveSnapshot };