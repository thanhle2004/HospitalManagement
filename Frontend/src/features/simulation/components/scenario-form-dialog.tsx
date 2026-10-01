"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useServices } from "@/features/services/hooks";
import { useRooms } from "@/features/rooms/hooks";
import { useCreateSimulationRun } from "../hooks";
import { simulationApi } from "../api";
import { toast } from "@/lib/toast-store";
import { buildCreateSimulationRunPayload } from "../presentation";
import type { SimulationClockPolicy, SimulationSpeed } from "../types";

/**
 * Thời lượng mặc định lấy từ RoomType.avgProcessTime. Fixed service time chỉ
 * còn là override tuỳ chọn cho controlled experiments.
 */
export function ScenarioFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: services } = useServices();
  const { data: rooms } = useRooms();
  const createRun = useCreateSimulationRun();

  const [name, setName] = useState("");
  const [seed, setSeed] = useState(12345);
  const [flowId, setFlowId] = useState<number | null>(null);
  const [patientCount, setPatientCount] = useState(20);
  const [arrivalKind, setArrivalKind] = useState<"FIXED" | "BURST">("FIXED");
  const [intervalSeconds, setIntervalSeconds] = useState(120);
  const [noShowPercent, setNoShowPercent] = useState(0);
  const [serviceTimeSeconds, setServiceTimeSeconds] = useState(600);
  const [useRoomTypeAvgProcessTime, setUseRoomTypeAvgProcessTime] = useState(true);
  const [selectedRoomIds, setSelectedRoomIds] = useState<number[]>([]);
  const [clockPolicy, setClockPolicy] = useState<SimulationClockPolicy>("PACED");
  const [speed, setSpeed] = useState<SimulationSpeed>(1);
  const [submitting, setSubmitting] = useState(false);

  const activeRooms = (rooms ?? []).filter((r) => r.status === "ACTIVE");

  function toggleRoom(roomId: number) {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId],
    );
  }

  async function handleSubmit() {
    if (!name.trim()) return toast.error("Cần đặt tên cho lượt mô phỏng");
    if (!flowId) return toast.error("Cần chọn 1 dịch vụ (Flow)");
    if (selectedRoomIds.length === 0) return toast.error("Cần chọn ít nhất 1 phòng");

    const payload = buildCreateSimulationRunPayload({
      name,
      seed,
      flowId,
      patientCount,
      arrivalKind,
      intervalSeconds,
      noShowPercent,
      selectedRoomIds,
      useRoomTypeAvgProcessTime,
      serviceTimeSeconds,
      clockPolicy,
      speed,
    });

    setSubmitting(true);
    let createdRunId: string | null = null;
    try {
      const { id } = await createRun.mutateAsync(payload);
      createdRunId = id;
      await simulationApi.start(id);
      toast.success("Đã tạo và bắt đầu lượt mô phỏng");
      onOpenChange(false);
    } catch {
      // useCreateSimulationRun đã tự báo lỗi tạo run. Chỉ báo lỗi start
      // riêng khi request tạo run thực sự đã trả về một id.
      if (createdRunId) {
        toast.error("Tạo run thành công nhưng không bắt đầu chạy được — thử bấm Bắt đầu ở trang chi tiết");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Tạo lượt mô phỏng mới"
        description="Cấu hình 1 scenario và bắt đầu chạy ngay"
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="sim-name">Tên</Label>
            <Input
              id="sim-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Burst 10 bệnh nhân"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sim-seed">Seed</Label>
              <Input
                id="sim-seed"
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="sim-flow">Dịch vụ (Flow)</Label>
              <Select
                id="sim-flow"
                value={flowId ?? ""}
                onChange={(e) => setFlowId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">-- Chọn dịch vụ --</option>
                {(services ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sim-count">Số bệnh nhân</Label>
              <Input
                id="sim-count"
                type="number"
                min={1}
                max={1000}
                value={patientCount}
                onChange={(e) => setPatientCount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="sim-arrival">Kiểu tới</Label>
              <Select
                id="sim-arrival"
                value={arrivalKind}
                onChange={(e) => setArrivalKind(e.target.value as "FIXED" | "BURST")}
              >
                <option value="FIXED">Cách đều (FIXED)</option>
                <option value="BURST">Cùng lúc (BURST)</option>
              </Select>
            </div>
          </div>

          {arrivalKind === "FIXED" && (
            <div>
              <Label htmlFor="sim-interval">Khoảng cách giữa 2 bệnh nhân (giây)</Label>
              <Input
                id="sim-interval"
                type="number"
                min={1}
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(Number(e.target.value))}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sim-noshow">Tỉ lệ không tới (%)</Label>
              <Input
                id="sim-noshow"
                type="number"
                min={0}
                max={100}
                value={noShowPercent}
                onChange={(e) => setNoShowPercent(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="sim-service">Override thời gian khám (giây)</Label>
              <Input
                id="sim-service"
                type="number"
                min={1}
                value={serviceTimeSeconds}
                disabled={useRoomTypeAvgProcessTime}
                onChange={(e) => setServiceTimeSeconds(Number(e.target.value))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={useRoomTypeAvgProcessTime} onChange={(e) => setUseRoomTypeAvgProcessTime(e.target.checked)} />
            Dùng thời gian khám trung bình hiệu lực của phòng (mặc định)
          </label>
          <p className="text-xs text-slate-500">Khi bật, mỗi phòng ưu tiên Room.avgProcessTime rồi fallback RoomType.avgProcessTime; cả hai đều tính bằng giây. Bỏ chọn để dùng override cố định.</p>

          <div>
            <Label>Phòng tham gia scenario</Label>
            <div className="mt-1 grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-slate-200 p-2">
              {activeRooms.map((room) => (
                <label key={room.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={selectedRoomIds.includes(room.id)}
                    onChange={() => toggleRoom(room.id)}
                  />
                  {room.roomNumber} · {room.name}
                </label>
              ))}
              {activeRooms.length === 0 && (
                <p className="col-span-2 text-sm text-slate-500">Không có phòng ACTIVE nào.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sim-clock">Chế độ xem</Label>
              <Select
                id="sim-clock"
                value={clockPolicy}
                onChange={(e) => setClockPolicy(e.target.value as SimulationClockPolicy)}
              >
                <option value="PACED">Xem trực tiếp (PACED)</option>
                <option value="STEP">Từng bước (STEP)</option>
                <option value="ASAP">Chạy nền lấy số liệu (ASAP)</option>
              </Select>
            </div>
            {clockPolicy === "PACED" && (
              <div>
                <Label htmlFor="sim-speed">Tốc độ ban đầu</Label>
                <Select
                  id="sim-speed"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value) as SimulationSpeed)}
                >
                  {[1, 2, 5, 10, 50].map((s) => (
                    <option key={s} value={s}>
                      {s}x
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button onClick={handleSubmit} isLoading={submitting}>
              Tạo và bắt đầu
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
