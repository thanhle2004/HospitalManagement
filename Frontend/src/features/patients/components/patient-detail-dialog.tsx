"use client";

import { useState } from "react";
import { CalendarDays, CircleAlert, Loader2, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { usePatientTypes } from "@/features/patient-types/hooks";
import { usePatientDetail, useUpdatePatientType } from "../hooks";

const GENDER_LABEL = {
  MALE: "Nam",
  FEMALE: "Nữ",
  OTHER: "Khác",
} as const;

function formatDate(value: string | null) {
  if (!value) return "Chưa cập nhật";
  return new Date(value).toLocaleDateString("vi-VN");
}

function InfoItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{value || "Chưa cập nhật"}</dd>
    </div>
  );
}

interface PatientDetailDialogProps {
  patientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PatientDetailDialog({
  patientId,
  open,
  onOpenChange,
}: PatientDetailDialogProps) {
  const patient = usePatientDetail(patientId, open);
  const patientTypes = usePatientTypes();
  const updateType = useUpdatePatientType();
  const [selectedTypeId, setSelectedTypeId] = useState("");

  const displayedTypeId = selectedTypeId || String(patient.data?.patientType.id ?? "");

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setSelectedTypeId("");
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto"
        title="Hồ sơ bệnh nhân"
        description="Thông tin cá nhân chỉ hiển thị cho tài khoản quản trị được phân quyền."
      >
        {patient.isLoading && (
          <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Đang tải hồ sơ...
          </div>
        )}

        {patient.isError && (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
            <CircleAlert className="h-8 w-8 text-red-600" />
            <p className="text-sm font-medium text-slate-900">Không tải được hồ sơ bệnh nhân</p>
            <Button variant="outline" size="sm" onClick={() => patient.refetch()}>
              Thử lại
            </Button>
          </div>
        )}

        {patient.data && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{patient.data.fullName}</h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="info">{patient.data.patientType.name}</Badge>
                  <Badge variant="default">
                    {patient.data.gender ? GENDER_LABEL[patient.data.gender] : "Chưa rõ giới tính"}
                  </Badge>
                </div>
              </div>
              <p className="font-mono text-xs text-slate-500">#{patient.data.id.slice(0, 8)}</p>
            </div>

            <div className="grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
              <div className="flex gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <InfoItem label="Số điện thoại" value={patient.data.phone} />
              </div>
              <div className="flex gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <InfoItem label="Email" value={patient.data.email} />
              </div>
              <div className="flex gap-3">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <InfoItem label="Ngày sinh" value={formatDate(patient.data.birthday)} />
              </div>
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <InfoItem label="Số giấy tờ" value={patient.data.identityNumber} />
              </div>
              <div className="flex gap-3 sm:col-span-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <InfoItem label="Địa chỉ" value={patient.data.address} />
              </div>
              <InfoItem label="Liên hệ khẩn cấp" value={patient.data.emergencyContact} />
              <InfoItem label="Ngày tạo hồ sơ" value={formatDate(patient.data.createdAt)} />
            </div>

            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
              <Label htmlFor="patient-type">Phân loại bệnh nhân</Label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <div className="flex-1">
                  <Select
                    id="patient-type"
                    value={displayedTypeId}
                    disabled={patientTypes.isLoading || updateType.isPending}
                    onChange={(event) => setSelectedTypeId(event.target.value)}
                  >
                    {patientTypes.data?.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} ({type.code})
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  disabled={
                    !selectedTypeId || Number(selectedTypeId) === patient.data.patientType.id
                  }
                  isLoading={updateType.isPending}
                  onClick={() => {
                    if (!patientId || !selectedTypeId) return;
                    updateType.mutate(
                      { id: patientId, patientTypeId: Number(selectedTypeId) },
                      { onSuccess: () => setSelectedTypeId("") },
                    );
                  }}
                >
                  Lưu phân loại
                </Button>
              </div>
              <p className="mt-2 text-xs text-sky-800">
                Thay đổi này được ghi vào nhật ký hoạt động của hệ thống.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
