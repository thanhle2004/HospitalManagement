"use client";

import { useState } from "react";
import { CalendarDays, ChevronRight, LogOut, Mail, MapPin, Phone, ShieldCheck, UserRound } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { usePatientLogout } from "@/features/patient-auth/hooks";
import { usePatientAuthStore } from "@/features/patient-auth/store";
import { PatientPageHeader } from "@/features/patient-portal/components/patient-page-header";
import { formatDate } from "@/features/patient-portal/format";

const genderLabel = { MALE: "Nam", FEMALE: "Nữ", OTHER: "Khác" } as const;

function ProfileRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-100 py-3.5 last:border-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-slate-900">{value || "Chưa cập nhật"}</p>
      </div>
    </div>
  );
}

export default function PatientProfilePage() {
  const patient = usePatientAuthStore((state) => state.patient);
  const logout = usePatientLogout();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const initial = patient?.fullName.trim().charAt(0).toUpperCase() || "B";

  if (!patient) return null;

  return (
    <div>
      <PatientPageHeader title="Hồ sơ cá nhân" description="Thông tin dùng trong quá trình tiếp nhận và khám bệnh." />

      <section className="rounded-3xl bg-gradient-to-br from-sky-600 to-sky-700 p-5 text-white shadow-lg shadow-sky-200/60">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-3xl bg-white/15 text-2xl font-bold ring-1 ring-white/20">{initial}</span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{patient.fullName}</h1>
            <p className="mt-1 text-sm text-sky-50">{patient.patientType.name}</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold"><ShieldCheck className="size-3" />Hồ sơ đã xác thực</span>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200/80 bg-white px-4 shadow-sm">
        <ProfileRow icon={Phone} label="Số điện thoại" value={patient.phone} />
        <ProfileRow icon={Mail} label="Email" value={patient.email} />
        <ProfileRow icon={CalendarDays} label="Ngày sinh" value={patient.birthday ? formatDate(patient.birthday) : null} />
        <ProfileRow icon={UserRound} label="Giới tính" value={patient.gender ? genderLabel[patient.gender] : null} />
        <ProfileRow icon={MapPin} label="Địa chỉ" value={patient.address} />
      </section>

      <section className="mt-5 rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-700"><ShieldCheck className="size-5" /></span>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-900">Quyền riêng tư và bảo mật</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Hồ sơ chỉ được dùng cho tiếp nhận, điều phối và chăm sóc sức khoẻ của bạn.</p>
          </div>
          <ChevronRight className="mt-2 size-4 text-slate-300" />
        </div>
      </section>

      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white text-sm font-semibold text-red-600 shadow-sm"
      >
        <LogOut className="size-4.5" />
        Đăng xuất
      </button>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Đăng xuất khỏi thiết bị?"
        description="Bạn sẽ cần xác thực lại bằng mã OTP khi đăng nhập lần sau."
        confirmLabel="Đăng xuất"
        isLoading={logout.isPending}
        onConfirm={() => logout.mutate()}
      />
    </div>
  );
}
