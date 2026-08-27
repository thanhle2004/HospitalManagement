"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateService, useUpdateService } from "../hooks";
import type { ClinicService } from "../types";

const serviceSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Mã dịch vụ không được để trống")
    .regex(/^[A-Za-z0-9_-]+$/, "Chỉ dùng chữ, số, dấu gạch ngang hoặc gạch dưới"),
  name: z.string().trim().min(1, "Tên dịch vụ không được để trống"),
  description: z.string(),
});

type ServiceFormValues = z.infer<typeof serviceSchema>;

interface ServiceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: ClinicService;
  onCreated?: (service: ClinicService) => void;
}

export function ServiceFormDialog({
  open,
  onOpenChange,
  service,
  onCreated,
}: ServiceFormDialogProps) {
  const isEditing = !!service;
  const createMutation = useCreateService();
  const updateMutation = useUpdateService();
  const isPending = createMutation.isPending || updateMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: { code: "", name: "", description: "" },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      code: service?.code ?? "",
      name: service?.name ?? "",
      description: service?.description ?? "",
    });
  }, [open, reset, service]);

  const onSubmit = async (values: ServiceFormValues) => {
    const payload = {
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      description: values.description.trim(),
    };

    try {
      if (service) {
        await updateMutation.mutateAsync({ id: service.id, payload });
      } else {
        const created = await createMutation.mutateAsync(payload);
        onCreated?.(created);
      }
      onOpenChange(false);
    } catch {
      // Mutation hook đã hiển thị thông báo lỗi và giữ form mở để người dùng sửa.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEditing ? "Sửa dịch vụ khám" : "Tạo dịch vụ khám"}
        description="Dịch vụ là một quy trình khám gồm một hoặc nhiều bước tại các loại phòng."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="service-code">Mã dịch vụ</Label>
            <Input
              id="service-code"
              placeholder="VD: KHAM_TONG_QUAT"
              autoComplete="off"
              className="uppercase"
              {...register("code")}
            />
            <p className="text-xs text-slate-500">Mã duy nhất, dùng để nhận diện trong hệ thống.</p>
            {errors.code && <p className="text-xs text-red-600">{errors.code.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="service-name">Tên dịch vụ</Label>
            <Input
              id="service-name"
              placeholder="VD: Khám sức khoẻ tổng quát"
              {...register("name")}
            />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="service-description">Mô tả (tuỳ chọn)</Label>
            <Textarea
              id="service-description"
              placeholder="Mô tả ngắn để nhân viên dễ chọn đúng dịch vụ..."
              {...register("description")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => onOpenChange(false)}
            >
              Huỷ
            </Button>
            <Button type="submit" isLoading={isPending}>
              {isEditing ? "Lưu thay đổi" : "Tạo và thiết kế"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
