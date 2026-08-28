"use client";

import { use, useState } from "react";
import { Check, CheckCircle2, CircleDashed, Clock3, DoorOpen, Info, LockKeyhole, MapPin, RefreshCw, Stethoscope, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PatientPageHeader } from "@/features/patient-portal/components/patient-page-header";
import { PatientQrCode } from "@/features/patient-portal/components/qr-code";
import { PatientState } from "@/features/patient-portal/components/patient-state";
import { VisitStatusPill } from "@/features/patient-portal/components/visit-card";
import { formatDateTime, shortVisitId, visitStepStatusLabel } from "@/features/patient-portal/format";
import { usePatientVisit } from "@/features/patient-portal/hooks";
import type { PatientVisitStep, VisitStepStatus } from "@/features/patient-portal/types";

const activePriority: VisitStepStatus[] = ["IN_PROGRESS", "CHECKED_IN", "ASSIGNED", "READY"];

function stepIcon(status: VisitStepStatus) {
  if (status === "COMPLETED") return Check;
  if (status === "SKIPPED" || status === "CANCELLED") return X;
  if (status === "LOCKED") return LockKeyhole;
  if (status === "IN_PROGRESS") return Stethoscope;
  return CircleDashed;
}

function stepTone(status: VisitStepStatus): string {
  if (status === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "IN_PROGRESS") return "border-teal-200 bg-teal-50 text-teal-700";
  if (["ASSIGNED", "CHECKED_IN", "READY"].includes(status)) return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "CANCELLED") return "border-red-200 bg-red-50 text-red-600";
  return "border-slate-200 bg-slate-50 text-slate-400";
}

function findCurrentStep(steps: PatientVisitStep[]): PatientVisitStep | undefined {
  for (const status of activePriority) {
    const step = steps.find((candidate) => candidate.status === status);
    if (step) return step;
  }
  return undefined;
}

export default function PatientVisitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const visit = usePatientVisit(id);

  if (visit.isLoading) return <PatientState variant="loading" description="Đang cập nhật tiến trình lượt khám." />;
  if (visit.isError || !visit.data) {
    return (
      <div>
        <PatientPageHeader title="Chi tiết lượt khám" backHref="/patient/visits" />
        <PatientState variant="error" title="Không tìm thấy lượt khám" description="Lượt khám không tồn tại hoặc không thuộc hồ sơ của bạn." />
      </div>
    );
  }

  const orderedSteps = [...visit.data.steps].sort((a, b) => a.displayOrder - b.displayOrder);
  const activeSteps = orderedSteps.filter((step) => activePriority.includes(step.status));
  const currentStep =
    activeSteps.find((step) => step.id === selectedStepId) ?? findCurrentStep(orderedSteps);
  const completedCount = orderedSteps.filter((step) => ["COMPLETED", "SKIPPED"].includes(step.status)).length;
  const progress = orderedSteps.length > 0 ? Math.round((completedCount / orderedSteps.length) * 100) : 0;
  return (
    <div>
      <PatientPageHeader title="Chi tiết lượt khám" description={`Mã lượt ${shortVisitId(visit.data.id)}`} backHref="/patient/visits" />

      <section className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Dịch vụ</p>
            <h1 className="mt-1 text-lg font-bold leading-6 text-slate-950">{visit.data.flow.name}</h1>
          </div>
          <VisitStatusPill status={visit.data.status} />
        </div>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-slate-500">
            <span>Tiến trình {completedCount}/{orderedSteps.length} bước</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-500">
          <RefreshCw className="size-3.5 text-teal-600" />
          Tự động cập nhật mỗi 5 giây
        </div>
      </section>

      {visit.data.status === "COMPLETED" ? (
        <section className="mt-5 flex items-start gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm"><CheckCircle2 className="size-5" /></span>
          <div>
            <h2 className="text-sm font-bold text-emerald-950">Lượt khám đã hoàn tất</h2>
            <p className="mt-1 text-xs leading-5 text-emerald-800">Hoàn thành lúc {visit.data.completedAt ? formatDateTime(visit.data.completedAt) : "—"}.</p>
          </div>
        </section>
      ) : currentStep ? (
        <>
        {activeSteps.length > 1 ? (
          <section className="mt-5">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-slate-900">Các phòng đang sẵn sàng</h2>
              <p className="mt-0.5 text-xs text-slate-500">Bạn có thể chọn một trong các phòng đang mở.</p>
            </div>
            <div className="flex snap-x gap-2.5 overflow-x-auto pb-1">
              {activeSteps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setSelectedStepId(step.id)}
                  className={cn(
                    "min-w-40 snap-start rounded-2xl border p-3 text-left transition",
                    currentStep.id === step.id
                      ? "border-teal-500 bg-teal-50 ring-2 ring-teal-100"
                      : "border-slate-200 bg-white",
                  )}
                >
                  <p className="text-xs font-semibold text-slate-900">{step.roomType.name}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {step.assignment
                      ? `Phòng ${step.assignment.room.roomNumber}`
                      : visitStepStatusLabel[step.status]}
                  </p>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        <section className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl shadow-slate-300/60">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-300">Bước hiện tại</p>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">{visitStepStatusLabel[currentStep.status]}</span>
            </div>
            <h2 className="mt-4 text-xl font-bold">{currentStep.roomType.name}</h2>
            {currentStep.assignment ? (
              <div className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                <DoorOpen className="size-4.5 text-teal-300" />
                <span>Phòng {currentStep.assignment.room.roomNumber} · {currentStep.assignment.room.name}</span>
                <MapPin className="size-4.5 text-teal-300" />
                <span className="text-slate-300">Đến đúng phòng và đưa mã QR cho thiết bị check-in.</span>
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-white/10 p-3 text-xs leading-5 text-slate-200">
                <Clock3 className="mt-0.5 size-4 shrink-0 text-amber-300" />
                Hệ thống đang tìm phòng có thời gian chờ phù hợp nhất cho bạn.
              </div>
            )}
          </div>

          {currentStep.assignment?.qrToken ? (
            <div className="border-t border-white/10 bg-white p-5 text-center text-slate-900">
              <div className="mx-auto w-fit rounded-3xl border border-slate-100 bg-white p-2 shadow-sm">
                <PatientQrCode token={currentStep.assignment.qrToken} />
              </div>
              <p className="mt-3 text-sm font-semibold">Quét mã để check-in</p>
              {currentStep.assignment.qrExpiresAt ? <p className="mt-1 text-xs text-slate-500">Có hiệu lực đến {formatDateTime(currentStep.assignment.qrExpiresAt)}</p> : null}
            </div>
          ) : null}
        </section>
        </>
      ) : (
        <section className="mt-5 flex items-start gap-3 rounded-3xl border border-slate-200 bg-white p-5">
          <Clock3 className="mt-0.5 size-5 shrink-0 text-slate-500" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Đang chờ cập nhật bước tiếp theo</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Vui lòng giữ màn hình này hoặc liên hệ quầy tiếp nhận nếu chờ quá lâu.</p>
          </div>
        </section>
      )}

      <section className="mt-7">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Các bước khám</h2>
            <p className="mt-0.5 text-xs text-slate-500">Trạng thái toàn bộ quy trình</p>
          </div>
        </div>
        {orderedSteps.length === 0 ? (
          <PatientState variant="empty" title="Chưa có bước khám" />
        ) : (
          <ol className="space-y-3">
            {orderedSteps.map((step, index) => {
              const Icon = stepIcon(step.status);
              const isCurrent = currentStep?.id === step.id;
              return (
                <li key={step.id} className={cn("rounded-2xl border bg-white p-4", isCurrent ? "border-teal-300 ring-2 ring-teal-100" : "border-slate-200/80")}>
                  <div className="flex items-start gap-3">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl border", stepTone(step.status))}><Icon className={cn("size-4", step.status === "READY" && "animate-spin")} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-medium text-slate-400">Bước {index + 1}</p>
                          <h3 className="mt-0.5 text-sm font-semibold text-slate-900">{step.roomType.name}</h3>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium text-slate-500">{visitStepStatusLabel[step.status]}</span>
                      </div>
                      {step.assignment ? <p className="mt-2 text-xs text-slate-500">Phòng {step.assignment.room.roomNumber} · {step.assignment.room.name}</p> : null}
                      {step.isOptional ? <p className="mt-2 text-[10px] font-medium text-amber-700">Bước tuỳ chọn</p> : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mt-5 flex items-start gap-2.5 rounded-2xl bg-slate-100 p-4 text-xs leading-5 text-slate-600">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-500" />
        Thứ tự thực tế có thể thay đổi để giảm thời gian chờ, nhưng mọi điều kiện y khoa trong quy trình vẫn được giữ nguyên.
      </section>
    </div>
  );
}
