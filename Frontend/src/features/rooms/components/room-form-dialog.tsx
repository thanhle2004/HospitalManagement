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
import { useCreateRoom, useUpdateRoom } from "../hooks";
import { useRoomTypes } from "@/features/room-types/hooks";
import type { Room } from "../types";

const schema = z.object({
  roomNumber: z.string().min(1, "Số phòng không được để trống"),
  name: z.string().min(1, "Tên phòng không được để trống"),
  sortOrder: z.coerce.number().int(),
  roomTypeId: z.coerce.number().int().positive("Vui lòng chọn loại phòng"),
});
type FormValues = z.infer<typeof schema>;

interface RoomFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room?: Room;
}

export function RoomFormDialog({ open, onOpenChange, room }: RoomFormDialogProps) {
  const isEditing = !!room;
  const roomTypes = useRoomTypes();
  const createMutation = useCreateRoom();
  const updateMutation = useUpdateRoom();
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
        roomNumber: room?.roomNumber ?? "",
        name: room?.name ?? "",
        sortOrder: room?.sortOrder ?? 0,
        roomTypeId: room?.roomType.id ?? undefined,
      });
    }
  }, [open, room, reset]);

  const onSubmit = (values: FormValues) => {
    const action = isEditing
      ? updateMutation.mutateAsync({ id: room.id, payload: values })
      : createMutation.mutateAsync(values);

    action.then(() => onOpenChange(false)).catch(() => {});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={isEditing ? "Sửa phòng khám" : "Tạo phòng khám"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="roomNumber">Số phòng</Label>
            <Input id="roomNumber" placeholder="VD: P101" {...register("roomNumber")} />
            {errors.roomNumber && (
              <p className="text-xs text-red-600">{errors.roomNumber.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Tên phòng</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="roomTypeId">Loại phòng</Label>
            <Select id="roomTypeId" {...register("roomTypeId")} disabled={roomTypes.isLoading}>
              <option value="">— Chọn loại phòng —</option>
              {roomTypes.data?.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name}
                </option>
              ))}
            </Select>
            {errors.roomTypeId && (
              <p className="text-xs text-red-600">{errors.roomTypeId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sortOrder">Thứ tự hiển thị</Label>
            <Input id="sortOrder" type="number" {...register("sortOrder")} />
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
