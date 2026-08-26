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
import { useCreatePatientType, useUpdatePatientType } from "../hooks";
import type { PatientType } from "../types";

const schema = z.object({
  code: z.string().min(1, "Code không được để trống"),
  name: z.string().min(1, "Tên không được để trống"),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface PatientTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientType?: PatientType;
}

export function PatientTypeFormDialog({ open, onOpenChange, patientType }: PatientTypeFormDialogProps) {
  const isEditing = !!patientType;
  const createMutation = useCreatePatientType();
  const updateMutation = useUpdatePatientType();
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
        code: patientType?.code ?? "",
        name: patientType?.name ?? "",
        description: patientType?.description ?? "",
      });
    }
  }, [open, patientType, reset]);

  const onSubmit = (values: FormValues) => {
    const action = isEditing
      ? updateMutation.mutateAsync({ id: patientType.id, payload: values })
      : createMutation.mutateAsync(values);

    action.then(() => onOpenChange(false)).catch(() => {});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={isEditing ? "Sửa loại bệnh nhân" : "Tạo loại bệnh nhân"}
        description='Code "STANDARD" là mặc định hệ thống dùng khi Patient đăng ký không chọn loại cụ thể.'
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="code">Code</Label>
            <Input id="code" placeholder="VD: VIP, STANDARD" {...register("code")} />
            {errors.code && <p className="text-xs text-red-600">{errors.code.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Tên loại bệnh nhân</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
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
