"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateDoctor } from "../hooks";

const schema = z.object({
  email: z.string().min(1, "Vui lòng nhập email").email("Email không hợp lệ"),
  password: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự"),
  fullName: z.string().min(1, "Họ tên không được để trống"),
  phone: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface DoctorFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DoctorFormDialog({ open, onOpenChange }: DoctorFormDialogProps) {
  const createMutation = useCreateDoctor();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) reset({ email: "", password: "", fullName: "", phone: "" });
  }, [open, reset]);

  const onSubmit = (values: FormValues) => {
    createMutation.mutateAsync(values).then(() => onOpenChange(false)).catch(() => {});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Tạo tài khoản Doctor"
        description="Doctor đăng nhập bằng email + mật khẩu này, nên đổi lại sau lần đăng nhập đầu."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Họ tên</Label>
            <Input id="fullName" {...register("fullName")} />
            {errors.fullName && <p className="text-xs text-red-600">{errors.fullName.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Mật khẩu tạm thời</Label>
            <Input id="password" type="text" {...register("password")} />
            {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Số điện thoại (tuỳ chọn)</Label>
            <Input id="phone" {...register("phone")} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button type="submit" isLoading={createMutation.isPending}>
              Tạo tài khoản
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
