"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateRoomType, useUpdateRoomType } from "../hooks";
import type { RoomType } from "../types";

const schema = z.object({
  name: z.string().min(1, "Tên không được để trống"),
  description: z.string().optional(),
  avgProcessTime: z.coerce.number().int().positive("Phải > 0 (đơn vị: phút)"),
});
type FormValues = z.infer<typeof schema>;

interface RoomTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Có giá trị = đang sửa; undefined = đang tạo mới */
  roomType?: RoomType;
}

export function RoomTypeFormDialog({ open, onOpenChange, roomType }: RoomTypeFormDialogProps) {
  const isEditing = !!roomType;
  const createMutation = useCreateRoomType();
  const updateMutation = useUpdateRoomType();
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
        name: roomType?.name ?? "",
        description: roomType?.description ?? "",
        avgProcessTime: roomType?.avgProcessTime ?? undefined,
      });
    }
  }, [open, roomType, reset]);

  const onSubmit = (values: FormValues) => {
    const action = isEditing
      ? updateMutation.mutateAsync({ id: roomType.id, payload: values })
      : createMutation.mutateAsync(values);

    action.then(() => onOpenChange(false)).catch(() => {});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEditing ? "Sửa loại phòng khám" : "Tạo loại phòng khám"}
        description="Ví dụ: Khám Nội, Khám Mắt, Xét nghiệm..."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="name">Tên loại phòng</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="avgProcessTime">Thời gian khám trung bình (phút)</Label>
            <Input id="avgProcessTime" type="number" min={1} {...register("avgProcessTime")} />
            {errors.avgProcessTime && (
              <p className="text-xs text-red-600">{errors.avgProcessTime.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Mô tả (tuỳ chọn)</Label>
            <Textarea id="description" {...register("description")} />
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
