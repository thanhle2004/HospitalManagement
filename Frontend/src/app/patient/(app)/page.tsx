"use client";

import Link from "next/link";
import { ArrowRight, CalendarPlus, ClipboardClock, ShieldCheck, UserRound } from "lucide-react";
import { usePatientAuthStore } from "@/features/patient-auth/store";
import { ServiceCard } from "@/features/patient-portal/components/service-card";
import { PatientState } from "@/features/patient-portal/components/patient-state";
import { VisitCard } from "@/features/patient-portal/components/visit-card";
import { usePatientServices, usePatientVisits } from "@/features/patient-portal/hooks";

const quickActions = [
  { href: "/patient/services", label: "Đăng ký khám", caption: "Chọn dịch vụ", icon: CalendarPlus, color: "bg-sky-50 text-sky-700" },
  { href: "/patient/visits", label: "Lượt khám", caption: "Xem lịch sử", icon: ClipboardClock, color: "bg-amber-50 text-amber-700" },
  { href: "/patient/profile", label: "Hồ sơ", caption: "Thông tin của bạn", icon: UserRound, color: "bg-sky-50 text-sky-700" },
];

export default function PatientHomePage() {
  const patient = usePatientAuthStore((state) => state.patient);
  const visits = usePatientVisits();
  const services = usePatientServices();
  const firstName = patient?.fullName.trim().split(/\s+/).at(-1) ?? "bạn";
  const activeVisit = visits.data
    ?.filter((visit) => visit.status !== "COMPLETED" && visit.status !== "CANCELLED")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

  return (
    <div className="space-y-7">
      <section>
        <p className="text-sm font-medium text-sky-700">Xin chào, {firstName} 👋</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Hôm nay bạn cần gì?</h1>
        <p className="mt-1.5 text-sm leading-5 text-slate-500">Đăng ký và theo dõi quy trình khám ngay trên điện thoại.</p>
      </section>

      {visits.isLoading ? (
        <div className="h-48 animate-pulse rounded-3xl bg-sky-100" />
      ) : activeVisit ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Lượt khám hiện tại</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700">
              <span className="size-1.5 animate-pulse rounded-full bg-sky-500" />
              Tự động cập nhật
            </span>
          </div>
          <VisitCard visit={activeVisit} highlighted />
        </section>
      ) : (
        <Link
          href="/patient/services"
          className="block overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 to-sky-700 p-5 text-white shadow-lg shadow-sky-200/70"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-white/15">
            <CalendarPlus className="size-5" />
          </span>
          <h2 className="mt-5 text-lg font-bold">Bắt đầu lượt khám mới</h2>
          <p className="mt-1.5 max-w-sm text-sm leading-5 text-sky-50">Chọn dịch vụ phù hợp, hệ thống sẽ hướng dẫn từng phòng cần đến.</p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold">Xem dịch vụ <ArrowRight className="size-4" /></span>
        </Link>
      )}

      <section>
        <h2 className="mb-3 text-sm font-bold text-slate-900">Truy cập nhanh</h2>
        <div className="grid grid-cols-3 gap-2.5">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
                <span className={`grid size-9 place-items-center rounded-xl ${action.color}`}><Icon className="size-4.5" /></span>
                <p className="mt-3 text-xs font-semibold leading-4 text-slate-900">{action.label}</p>
                <p className="mt-0.5 hidden text-[10px] text-slate-500 min-[390px]:block">{action.caption}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Dịch vụ nổi bật</h2>
            <p className="mt-0.5 text-xs text-slate-500">Chọn quy trình phù hợp với nhu cầu</p>
          </div>
          <Link href="/patient/services" className="text-xs font-semibold text-sky-700">Xem tất cả</Link>
        </div>
        {services.isLoading ? (
          <div className="space-y-3">{[1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-3xl bg-slate-100" />)}</div>
        ) : services.isError ? (
          <PatientState variant="error" description="Kéo xuống hoặc mở lại trang để thử lại." />
        ) : (
          <div className="space-y-3">{services.data?.slice(0, 3).map((service) => <ServiceCard key={service.id} service={service} />)}</div>
        )}
      </section>

      <section className="flex items-start gap-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm"><ShieldCheck className="size-5" /></span>
        <div>
          <h2 className="text-sm font-semibold text-emerald-950">Thông tin của bạn được bảo vệ</h2>
          <p className="mt-1 text-xs leading-5 text-emerald-800">Chỉ bạn và nhân viên y tế có thẩm quyền mới có thể xem hồ sơ và lượt khám.</p>
        </div>
      </section>
    </div>
  );
}
