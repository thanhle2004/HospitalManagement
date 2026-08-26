"use client";

import { useState } from "react";
import { Plus, Pencil, KeyRound } from "lucide-react";
import { useDevices, useUpdateDeviceStatus, useRegenerateDeviceSecret } from "@/features/devices/hooks";
import { DeviceFormDialog } from "@/features/devices/components/device-form-dialog";
import { DeviceSecretDialog } from "@/features/devices/components/device-secret-dialog";
import type { Device, DeviceStatus, DeviceWithSecret } from "@/features/devices/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DevicesPage() {
  const devices = useDevices();
  const updateStatus = useUpdateDeviceStatus();
  const regenerateSecret = useRegenerateDeviceSecret();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Device | undefined>();
  const [secretResult, setSecretResult] = useState<DeviceWithSecret | null>(null);
  const [regenerateTarget, setRegenerateTarget] = useState<Device | null>(null);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (device: Device) => {
    setEditing(device);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Thiết bị</h1>
          <p className="text-sm text-slate-500">Thiết bị Android dùng để quét QR check-in</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Đăng ký thiết bị
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Phòng</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead>Heartbeat gần nhất</TableHead>
              <TableHead className="w-32 text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500">
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {devices.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-slate-500">
                  Chưa có thiết bị nào
                </TableCell>
              </TableRow>
            )}
            {devices.data?.map((device) => (
              <TableRow key={device.id}>
                <TableCell className="font-medium text-slate-900">{device.code}</TableCell>
                <TableCell>{device.name}</TableCell>
                <TableCell>
                  {device.room.roomNumber} — {device.room.name}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() =>
                      updateStatus.mutate({
                        id: device.id,
                        status: (device.status === "ACTIVE" ? "INACTIVE" : "ACTIVE") as DeviceStatus,
                      })
                    }
                    disabled={updateStatus.isPending}
                  >
                    <Badge variant={device.status === "ACTIVE" ? "success" : "default"}>
                      {device.status === "ACTIVE" ? "Đang hoạt động" : "Đã tắt"}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="text-xs text-slate-500">
                  {device.lastHeartbeatAt
                    ? new Date(device.lastHeartbeatAt).toLocaleString("vi-VN")
                    : "Chưa từng kết nối"}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setRegenerateTarget(device)}>
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(device)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <DeviceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        device={editing}
        onCreated={(created) => setSecretResult(created)}
      />

      {secretResult && (
        <DeviceSecretDialog
          open={!!secretResult}
          onOpenChange={(open) => !open && setSecretResult(null)}
          deviceCode={secretResult.code}
          secret={secretResult.secret}
        />
      )}

      <ConfirmDialog
        open={!!regenerateTarget}
        onOpenChange={(open) => !open && setRegenerateTarget(null)}
        variant="default"
        confirmLabel="Cấp secret mới"
        title="Cấp secret mới?"
        description={`Secret cũ của "${regenerateTarget?.code}" sẽ NGỪNG hoạt động ngay lập tức. Chỉ làm việc này khi thiết bị thất lạc hoặc nghi lộ secret.`}
        isLoading={regenerateSecret.isPending}
        onConfirm={() => {
          if (!regenerateTarget) return;
          regenerateSecret.mutate(regenerateTarget.id, {
            onSuccess: (result) => {
              setRegenerateTarget(null);
              setSecretResult(result);
            },
          });
        }}
      />
    </div>
  );
}
