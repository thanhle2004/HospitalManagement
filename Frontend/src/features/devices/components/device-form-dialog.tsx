"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useCreateDevice, useUpdateDevice } from "../hooks";
import { useRooms } from "@/features/rooms/hooks";
import type { Device, DeviceWithSecret } from "../types";

const schema = z.object({
  code: z.string().min(1, "Code không được để trống"),
  name: z.string().min(1, "Tên thiết bị không được để trống"),
  roomId: z.coerce.number().int().positive("Vui lòng chọn phòng"),
});
type FormValues = z.infer<typeof schema>;

interface DeviceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device?: Device;
  /** Gọi lại khi tạo mới thành công, để trang cha mở DeviceSecretDialog hiện secret */
  onCreated?: (device: DeviceWithSecret) => void;
}

export function DeviceFormDialog({ open, onOpenChange, device, onCreated }: DeviceFormDialogProps) {
  const isEditing = !!device;
  const rooms = useRooms();
  const createMutation = useCreateDevice();
  const updateMutation = useUpdateDevice();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset({
        code: device?.code ?? "",
        name: device?.name ?? "",
        roomId: device?.room.id ?? undefined,
      });
    }
  }, [open, device, reset]);

  const onSubmit = (values: FormValues) => {
    if (isEditing) {
      updateMutation
        .mutateAsync({ id: device.id, payload: { name: values.name, roomId: values.roomId } })
        .then(() => onOpenChange(false))
        .catch(() => {});
      return;
    }

    createMutation
      .mutateAsync(values)
      .then((created) => {
        onOpenChange(false);
        onCreated?.(created);
      })
      .catch(() => {});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={isEditing ? "Sửa thiết bị" : "Đăng ký thiết bị mới"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              placeholder="VD: SCANNER-P101"
              disabled={isEditing}
              {...register("code")}
            />
            {errors.code && <p className="text-xs text-red-600">{errors.code.message}</p>}
            {isEditing && (
              <p className="text-xs text-slate-400">Không thể đổi code sau khi tạo</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Tên thiết bị</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="roomId">Phòng lắp đặt</Label>
            <Select id="roomId" {...register("roomId")} disabled={rooms.isLoading}>
              <option value="">— Chọn phòng —</option>
              {rooms.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} — {r.name}
                </option>
              ))}
            </Select>
            {errors.roomId && <p className="text-xs text-red-600">{errors.roomId.message}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" isLoading={isPending}>
              {isEditing ? "Lưu thay đổi" : "Tạo mới"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
