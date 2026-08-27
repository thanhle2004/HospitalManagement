"use client";

import { useEffect } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useRoomTypes } from "@/features/room-types/hooks";
import { useCreateServiceStep, useUpdateServiceStep } from "../hooks";
import type { ServiceStep } from "../types";

const stepSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Mã bước không được để trống")
    .regex(/^[A-Za-z0-9_-]+$/, "Chỉ dùng chữ, số, dấu gạch ngang hoặc gạch dưới"),
  roomTypeId: z.coerce.number().int().positive("Vui lòng chọn loại phòng"),
  displayOrder: z.coerce.number().int().min(1, "Thứ tự phải từ 1 trở lên"),
  isOptional: z.boolean(),
});

type StepFormValues = z.infer<typeof stepSchema>;

interface ServiceStepFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: number;
  step?: ServiceStep;
  suggestedOrder: number;
}

export function ServiceStepFormDialog({
  open,
  onOpenChange,
  serviceId,
  step,
  suggestedOrder,
}: ServiceStepFormDialogProps) {
  const roomTypes = useRoomTypes();
  const createMutation = useCreateServiceStep();
  const updateMutation = useUpdateServiceStep();
  const isEditing = !!step;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StepFormValues>({
    resolver: zodResolver(stepSchema),
    defaultValues: { code: "", displayOrder: 1, isOptional: false },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      code: step?.code ?? "",
      roomTypeId: step?.roomType.id,
      displayOrder: step?.displayOrder ?? suggestedOrder,
      isOptional: step?.isOptional ?? false,
    });
  }, [open, reset, step, suggestedOrder]);

  const onSubmit = async (values: StepFormValues) => {
    const payload = {
      ...values,
      code: values.code.trim().toUpperCase(),
    };

    try {
      if (step) {
        await updateMutation.mutateAsync({ serviceId, stepId: step.id, payload });
      } else {
        await createMutation.mutateAsync({ serviceId, payload });
      }
      onOpenChange(false);
    } catch {
      // Mutation hook đã hiển thị thông báo lỗi và giữ form mở để người dùng sửa.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEditing ? "Sửa bước khám" : "Thêm bước khám"}
        description="Mỗi bước đưa bệnh nhân đến một loại phòng trong quy trình dịch vụ."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="step-code">Mã bước</Label>
            <Input
              id="step-code"
              placeholder="VD: TIEP_NHAN, XET_NGHIEM"
              autoComplete="off"
              className="uppercase"
              {...register("code")}
            />
            {errors.code && <p className="text-xs text-red-600">{errors.code.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="step-room-type">Loại phòng thực hiện</Label>
            <Select
              id="step-room-type"
              disabled={roomTypes.isLoading || roomTypes.data?.length === 0}
              {...register("roomTypeId")}
            >
              <option value="">— Chọn loại phòng —</option>
              {roomTypes.data?.map((roomType) => (
                <option key={roomType.id} value={roomType.id}>
                  {roomType.name}
                </option>
              ))}
            </Select>
            {roomTypes.isError && (
              <p className="text-xs text-red-600">Không tải được danh sách loại phòng.</p>
            )}
            {roomTypes.data?.length === 0 && (
              <p className="text-xs text-amber-700">
                Chưa có loại phòng. Hãy tạo tại{" "}
                <Link href="/admin/room-types" className="font-medium underline">
                  Quản lý loại phòng
                </Link>
                .
              </p>
            )}
            {errors.roomTypeId && (
              <p className="text-xs text-red-600">{errors.roomTypeId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="step-order">Thứ tự hiển thị</Label>
            <Input id="step-order" type="number" min={1} {...register("displayOrder")} />
            <p className="text-xs text-slate-500">
              Dùng để sắp xếp các bước trên màn hình; điều kiện trước mới quyết định bước có được chạy hay chưa.
            </p>
            {errors.displayOrder && (
              <p className="text-xs text-red-600">{errors.displayOrder.message}</p>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-slate-900"
              {...register("isOptional")}
            />
            <span>
              <span className="block text-sm font-medium text-slate-900">Bước tuỳ chọn</span>
              <span className="block text-xs text-slate-500">
                Quy trình vẫn có thể hoàn tất khi bước này không cần thực hiện.
              </span>
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Huỷ
            </Button>
            <Button
              type="submit"
              isLoading={isPending}
              disabled={roomTypes.data?.length === 0}
            >
              {isEditing ? "Lưu thay đổi" : "Thêm bước"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
