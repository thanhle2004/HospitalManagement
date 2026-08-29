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
import { useCreateDoctorAssignment } from "../hooks";
import { useDoctors } from "@/features/doctors/hooks";
import { useRooms } from "@/features/rooms/hooks";

const schema = z
  .object({
    doctorId: z.string().min(1, "Vui lòng chọn bác sĩ"),
    roomId: z.coerce.number().int().positive("Vui lòng chọn phòng"),
    startTime: z.string().min(1, "Vui lòng chọn giờ bắt đầu"),
    endTime: z.string().optional(),
  })
  .refine((data) => !data.endTime || data.endTime > data.startTime, {
    message: "Giờ kết thúc phải sau giờ bắt đầu",
    path: ["endTime"],
  });
type FormValues = z.infer<typeof schema>;

interface DoctorAssignmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toLocalDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function DoctorAssignmentFormDialog({ open, onOpenChange }: DoctorAssignmentFormDialogProps) {
  const doctors = useDoctors();
  const rooms = useRooms();
  const createMutation = useCreateDoctorAssignment();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      const start = new Date();
      start.setSeconds(0, 0);
      const end = new Date(start.getTime() + 8 * 60 * 60 * 1_000);
      reset({
        doctorId: "",
        roomId: undefined,
        startTime: toLocalDateTimeInput(start),
        endTime: toLocalDateTimeInput(end),
      });
    }
  }, [open, reset]);

  const onSubmit = (values: FormValues) => {
    createMutation
      .mutateAsync({
        doctorId: values.doctorId,
        roomId: values.roomId,
        startTime: new Date(values.startTime).toISOString(),
        endTime: values.endTime ? new Date(values.endTime).toISOString() : undefined,
      })
      .then(() => onOpenChange(false))
      .catch(() => {});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Phân phòng trực cho bác sĩ"
        description="Một bác sĩ và một phòng khám không thể có hai ca trùng giờ."
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="doctorId">Bác sĩ</Label>
            <Select id="doctorId" {...register("doctorId")} disabled={doctors.isLoading}>
              <option value="">— Chọn bác sĩ —</option>
              {doctors.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.profile?.fullName ?? d.email}
                </option>
              ))}
            </Select>
            {errors.doctorId && <p className="text-xs text-red-600">{errors.doctorId.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="roomId">Phòng khám</Label>
            <Select id="roomId" {...register("roomId")} disabled={rooms.isLoading}>
              <option value="">— Chọn phòng —</option>
              {rooms.data?.filter((r) => r.status === "ACTIVE").map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} — {r.name}
                </option>
              ))}
            </Select>
            {errors.roomId && <p className="text-xs text-red-600">{errors.roomId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startTime">Bắt đầu</Label>
              <Input id="startTime" type="datetime-local" {...register("startTime")} />
              {errors.startTime && (
                <p className="text-xs text-red-600">{errors.startTime.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime">Kết thúc (tuỳ chọn)</Label>
              <Input id="endTime" type="datetime-local" {...register("endTime")} />
              {errors.endTime && <p className="text-xs text-red-600">{errors.endTime.message}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Huỷ
            </Button>
            <Button
              type="submit"
              className="bg-sky-700 hover:bg-sky-800 focus-visible:ring-sky-700"
              isLoading={createMutation.isPending}
            >
              Xác nhận phân phòng
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
