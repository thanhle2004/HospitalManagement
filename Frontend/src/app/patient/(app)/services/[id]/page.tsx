"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, CheckCircle2, Clock3, GitBranch, Info, Shuffle, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ApiError } from "@/lib/api-client";
import { PatientPageHeader } from "@/features/patient-portal/components/patient-page-header";
import { PatientState } from "@/features/patient-portal/components/patient-state";
import {
  useCreatePatientVisit,
  usePatientServiceDetail,
  usePatientVisits,
} from "@/features/patient-portal/hooks";

export default function PatientServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const serviceId = Number(id);
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const service = usePatientServiceDetail(Number.isInteger(serviceId) && serviceId > 0 ? serviceId : null);
  const visits = usePatientVisits();
  const createVisit = useCreatePatientVisit();
  const activeVisit = visits.data
    ?.filter((visit) => visit.status !== "COMPLETED" && visit.status !== "CANCELLED")
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];

  const registerVisit = () => {
    if (!service.data) return;
    createVisit.mutate(service.data.id, {
      onSuccess: (visit) => {
        setConfirmOpen(false);
        router.push(`/patient/visits/${visit.id}`);
      },
    });
  };

  if (service.isLoading) return <PatientState variant="loading" description="Đang tải quy trình dịch vụ." />;
  if (service.isError || !service.data) {
    return (
      <div>
        <PatientPageHeader title="Chi tiết dịch vụ" backHref="/patient/services" />
        <PatientState variant="error" title="Không tìm thấy dịch vụ" description="Dịch vụ có thể đã ngừng hoạt động hoặc đường dẫn không hợp lệ." />
      </div>
    );
  }

  const dependencyCount = service.data.steps.reduce((total, step) => total + step.dependsOn.length, 0);
  const stepsById = new Map(service.data.steps.map((step) => [step.id, step]));
  const orderedSteps = [...service.data.steps].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div>
      <PatientPageHeader title="Chi tiết dịch vụ" backHref="/patient/services" />

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 to-teal-700 p-5 text-white shadow-lg shadow-teal-200/60">
        <span className="grid size-12 place-items-center rounded-2xl bg-white/15"><Stethoscope className="size-6" /></span>
        <h1 className="mt-5 text-xl font-bold leading-7">{service.data.name}</h1>
        <p className="mt-2 text-sm leading-6 text-teal-50">{service.data.description || "Quy trình khám được thiết kế để điều phối bạn tới phòng phù hợp."}</p>
        <div className="mt-5 flex gap-2 text-[11px] font-semibold">
          <span className="rounded-full bg-white/15 px-3 py-1.5">{service.data.steps.length} bước khám</span>
          <span className="rounded-full bg-white/15 px-3 py-1.5">{new Set(service.data.steps.map((step) => step.roomType.id)).size} loại phòng</span>
        </div>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Quy trình dự kiến</h2>
            <p className="mt-0.5 text-xs text-slate-500">Bác sĩ có thể điều chỉnh theo tình trạng thực tế.</p>
          </div>
        </div>

        <div className={`mb-4 flex items-start gap-3 rounded-2xl border p-4 ${dependencyCount === 0 ? "border-emerald-100 bg-emerald-50" : "border-sky-100 bg-sky-50"}`}>
          <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-white ${dependencyCount === 0 ? "text-emerald-700" : "text-sky-700"}`}>
            {dependencyCount === 0 ? <Shuffle className="size-4.5" /> : <GitBranch className="size-4.5" />}
          </span>
          <div>
            <p className={`text-xs font-semibold ${dependencyCount === 0 ? "text-emerald-950" : "text-sky-950"}`}>
              {dependencyCount === 0 ? "Các phòng có thể khám linh hoạt" : "Quy trình có thứ tự trước – sau"}
            </p>
            <p className={`mt-1 text-[11px] leading-5 ${dependencyCount === 0 ? "text-emerald-800" : "text-sky-800"}`}>
              {dependencyCount === 0
                ? "Hệ thống chọn thứ tự phù hợp theo hàng đợi, bạn không cần đi đúng thứ tự hiển thị."
                : "Một số phòng chỉ được mở sau khi bạn hoàn tất các bước bắt buộc trước đó."}
            </p>
          </div>
        </div>

        {orderedSteps.length === 0 ? (
          <PatientState variant="empty" title="Quy trình chưa sẵn sàng" description="Dịch vụ này chưa có bước khám để đăng ký." />
        ) : (
          <ol className="space-y-0">
            {orderedSteps.map((step, index) => {
              const prerequisites = step.dependsOn.map((stepId) => stepsById.get(stepId)?.roomType.name).filter(Boolean);
              return (
                <li key={step.id}>
                  <div className="flex gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-sm font-bold text-teal-700">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{step.roomType.name}</h3>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${step.isOptional ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {step.isOptional ? "Tuỳ chọn" : "Bắt buộc"}
                        </span>
                      </div>
                      {prerequisites.length > 0 ? (
                        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-slate-500"><Clock3 className="mt-0.5 size-3.5 shrink-0" />Mở sau: {prerequisites.join(", ")}</p>
                      ) : (
                        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><CheckCircle2 className="size-3.5 text-emerald-600" />Có thể được điều phối ngay</p>
                      )}
                    </div>
                  </div>
                  {index < orderedSteps.length - 1 ? <div className="flex h-7 items-center pl-6 text-slate-300"><ArrowDown className="size-4" /></div> : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-2.5 text-xs leading-5 text-slate-600">
          <Info className="mt-0.5 size-4 shrink-0 text-teal-700" />
          Khi đăng ký, hệ thống sẽ tạo một lượt khám và tự động điều phối phòng phù hợp cho từng bước.
        </div>
      </section>

      <div className="sticky bottom-24 z-20 mt-6 rounded-2xl border border-slate-200/80 bg-white/95 p-3 shadow-xl shadow-slate-900/10 backdrop-blur-xl">
        {activeVisit ? (
          <Link href={`/patient/visits/${activeVisit.id}`} className="flex h-12 w-full items-center justify-center rounded-xl bg-amber-100 px-4 text-sm font-semibold text-amber-900">
            Xem lượt khám đang thực hiện
          </Link>
        ) : (
          <Button
            size="lg"
            className="w-full rounded-xl bg-teal-600 hover:bg-teal-700"
            disabled={orderedSteps.length === 0}
            onClick={() => setConfirmOpen(true)}
          >
            Đăng ký dịch vụ này
          </Button>
        )}
        {createVisit.isError ? (
          <p className="mt-2 text-center text-xs text-red-600">{createVisit.error instanceof ApiError ? createVisit.error.message : "Không thể tạo lượt khám"}</p>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Xác nhận đăng ký khám"
        description={`Tạo lượt khám mới cho dịch vụ “${service.data.name}”? Sau khi xác nhận, hệ thống sẽ bắt đầu điều phối phòng.`}
        confirmLabel="Xác nhận đăng ký"
        variant="default"
        isLoading={createVisit.isPending}
        onConfirm={registerVisit}
      />
    </div>
  );
}
