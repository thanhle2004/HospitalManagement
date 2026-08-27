"use client";

import { useMemo, useState } from "react";
import {
  ArrowDown,
  CircleAlert,
  GitBranch,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  useCreateServiceDependency,
  useDeleteServiceDependency,
  useDeleteServiceStep,
  useServiceDetail,
} from "../hooks";
import type { ClinicService, ServiceStep } from "../types";
import { ServiceStepFormDialog } from "./service-step-form-dialog";

interface ServiceWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ClinicService | null;
}

function stepLabel(step: ServiceStep) {
  return `${step.code} · ${step.roomType.name}`;
}

export function ServiceWorkflowDialog({
  open,
  onOpenChange,
  service,
}: ServiceWorkflowDialogProps) {
  const detail = useServiceDetail(service?.id ?? null, open);
  const createDependency = useCreateServiceDependency();
  const deleteDependency = useDeleteServiceDependency();
  const deleteStep = useDeleteServiceStep();

  const [stepFormOpen, setStepFormOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<ServiceStep>();
  const [deleteTarget, setDeleteTarget] = useState<ServiceStep | null>(null);
  const [targetStepId, setTargetStepId] = useState("");
  const [requiredStepId, setRequiredStepId] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    setStepFormOpen(false);
    setEditingStep(undefined);
    setDeleteTarget(null);
    setTargetStepId("");
    setRequiredStepId("");
    onOpenChange(false);
  };

  const steps = useMemo(
    () => [...(detail.data?.steps ?? [])].sort((a, b) => a.displayOrder - b.displayOrder),
    [detail.data?.steps],
  );

  const selectedTarget = steps.find((step) => step.id === Number(targetStepId));
  const availablePrerequisites = selectedTarget
    ? steps.filter(
        (step) => step.id !== selectedTarget.id && !selectedTarget.dependsOn.includes(step.id),
      )
    : [];
  const nextOrder = Math.max(0, ...steps.map((step) => step.displayOrder)) + 1;

  const openCreateStep = () => {
    setEditingStep(undefined);
    setStepFormOpen(true);
  };

  const openEditStep = (step: ServiceStep) => {
    setEditingStep(step);
    setStepFormOpen(true);
  };

  const addDependency = () => {
    if (!service || !targetStepId || !requiredStepId) return;
    createDependency.mutate(
      {
        serviceId: service.id,
        payload: {
          stepId: Number(targetStepId),
          requiredStepId: Number(requiredStepId),
        },
      },
      { onSuccess: () => setRequiredStepId("") },
    );
  };

  if (!service) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-h-[92vh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto"
          title={`Thiết kế quy trình · ${service.name}`}
          description={`${service.code} — sắp xếp các bước và khai báo điều kiện cần hoàn tất trước.`}
        >
          {detail.isLoading && (
            <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Đang tải quy trình...
            </div>
          )}

          {detail.isError && (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-red-200 bg-red-50 p-6 text-center">
              <CircleAlert className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-800">Không tải được quy trình dịch vụ</p>
                <p className="mt-1 text-xs text-red-700">Vui lòng thử lại hoặc kiểm tra kết nối.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => detail.refetch()}>
                Thử lại
              </Button>
            </div>
          )}

          {detail.data && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
              <section className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">Các bước khám</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Thứ tự giúp dễ theo dõi; điều kiện trước kiểm soát khi nào một bước được mở.
                    </p>
                  </div>
                  <Button size="sm" onClick={openCreateStep}>
                    <Plus className="h-4 w-4" />
                    Thêm bước
                  </Button>
                </div>

                {steps.length === 0 ? (
                  <button
                    type="button"
                    onClick={openCreateStep}
                    className="flex min-h-56 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center transition-colors hover:border-slate-400 hover:bg-slate-100"
                  >
                    <GitBranch className="h-9 w-9 text-slate-400" />
                    <span className="mt-3 text-sm font-medium text-slate-800">
                      Quy trình chưa có bước khám
                    </span>
                    <span className="mt-1 max-w-sm text-xs text-slate-500">
                      Bắt đầu bằng cách chọn loại phòng đầu tiên mà bệnh nhân cần đến.
                    </span>
                  </button>
                ) : (
                  <ol className="space-y-2">
                    {steps.map((step, index) => {
                      const prerequisites = step.dependsOn
                        .map((id) => steps.find((candidate) => candidate.id === id))
                        .filter((candidate): candidate is ServiceStep => !!candidate);

                      return (
                        <li key={step.id}>
                          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800">
                                {step.displayOrder}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-mono text-sm font-semibold text-slate-900">
                                    {step.code}
                                  </h3>
                                  <Badge variant="info">{step.roomType.name}</Badge>
                                  <Badge variant={step.isOptional ? "warning" : "success"}>
                                    {step.isOptional ? "Tuỳ chọn" : "Bắt buộc"}
                                  </Badge>
                                </div>

                                <div className="mt-3">
                                  <p className="text-xs font-medium text-slate-500">Chỉ mở sau khi</p>
                                  {prerequisites.length > 0 ? (
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                      {prerequisites.map((requiredStep) => (
                                        <span
                                          key={requiredStep.id}
                                          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700"
                                        >
                                          {requiredStep.code}
                                          <button
                                            type="button"
                                            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-red-600 disabled:opacity-50"
                                            title={`Gỡ điều kiện ${requiredStep.code}`}
                                            aria-label={`Gỡ điều kiện ${requiredStep.code}`}
                                            disabled={deleteDependency.isPending}
                                            onClick={() =>
                                              deleteDependency.mutate({
                                                serviceId: service.id,
                                                stepId: step.id,
                                                requiredStepId: requiredStep.id,
                                              })
                                            }
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="mt-1 text-xs text-slate-500">
                                      Không có điều kiện — có thể bắt đầu ngay.
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex shrink-0 gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title={`Sửa bước ${step.code}`}
                                  aria-label={`Sửa bước ${step.code}`}
                                  onClick={() => openEditStep(step)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title={`Xoá bước ${step.code}`}
                                  aria-label={`Xoá bước ${step.code}`}
                                  onClick={() => setDeleteTarget(step)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          {index < steps.length - 1 && (
                            <div className="flex h-6 items-center pl-4 text-slate-300" aria-hidden="true">
                              <ArrowDown className="h-4 w-4" />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>

              <aside className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-white p-2 shadow-sm">
                      <GitBranch className="h-5 w-5 text-sky-700" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">Thêm điều kiện trước</h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Ví dụ: bước “Khám kết luận” chỉ mở sau khi “Xét nghiệm” hoàn tất.
                      </p>
                    </div>
                  </div>

                  {steps.length < 2 ? (
                    <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      Cần ít nhất 2 bước để tạo điều kiện trước.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="dependency-target">Bước cần chờ</Label>
                        <Select
                          id="dependency-target"
                          value={targetStepId}
                          onChange={(event) => {
                            setTargetStepId(event.target.value);
                            setRequiredStepId("");
                          }}
                        >
                          <option value="">— Chọn bước —</option>
                          {steps.map((step) => (
                            <option key={step.id} value={step.id}>
                              {stepLabel(step)}
                            </option>
                          ))}
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="dependency-required">Phải hoàn tất bước</Label>
                        <Select
                          id="dependency-required"
                          value={requiredStepId}
                          disabled={!selectedTarget || availablePrerequisites.length === 0}
                          onChange={(event) => setRequiredStepId(event.target.value)}
                        >
                          <option value="">— Chọn bước trước —</option>
                          {availablePrerequisites.map((step) => (
                            <option key={step.id} value={step.id}>
                              {stepLabel(step)}
                            </option>
                          ))}
                        </Select>
                        {selectedTarget && availablePrerequisites.length === 0 && (
                          <p className="text-xs text-slate-500">
                            Bước này đã có điều kiện với tất cả bước còn lại.
                          </p>
                        )}
                      </div>

                      <Button
                        className="w-full"
                        disabled={!targetStepId || !requiredStepId}
                        isLoading={createDependency.isPending}
                        onClick={addDependency}
                      >
                        Thêm điều kiện
                      </Button>

                      <p className="text-xs text-slate-500">
                        Hệ thống tự từ chối điều kiện tạo vòng lặp trong quy trình.
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
                    Tóm tắt quy trình
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-sky-700">Tổng số bước</dt>
                      <dd className="mt-0.5 font-semibold text-sky-950">{steps.length}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-sky-700">Bước tuỳ chọn</dt>
                      <dd className="mt-0.5 font-semibold text-sky-950">
                        {steps.filter((step) => step.isOptional).length}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-sky-700">Điều kiện trước</dt>
                      <dd className="mt-0.5 font-semibold text-sky-950">
                        {steps.reduce((total, step) => total + step.dependsOn.length, 0)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-sky-700">Loại phòng</dt>
                      <dd className="mt-0.5 font-semibold text-sky-950">
                        {new Set(steps.map((step) => step.roomType.id)).size}
                      </dd>
                    </div>
                  </dl>
                </div>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ServiceStepFormDialog
        open={stepFormOpen}
        onOpenChange={setStepFormOpen}
        serviceId={service.id}
        step={editingStep}
        suggestedOrder={nextOrder}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(nextOpen) => !nextOpen && setDeleteTarget(null)}
        title="Xoá bước khám?"
        description={`Bước “${deleteTarget?.code ?? ""}” và mọi điều kiện liên quan sẽ bị xoá khỏi quy trình.`}
        confirmLabel="Xoá bước"
        isLoading={deleteStep.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteStep.mutate(
            { serviceId: service.id, stepId: deleteTarget.id },
            { onSuccess: () => setDeleteTarget(null) },
          );
        }}
      />
    </>
  );
}
