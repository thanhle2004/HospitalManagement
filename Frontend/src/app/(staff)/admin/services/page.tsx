"use client";

import { useMemo, useState } from "react";
import {
  CircleAlert,
  GitBranch,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ServiceFormDialog } from "@/features/services/components/service-form-dialog";
import { ServiceWorkflowDialog } from "@/features/services/components/service-workflow-dialog";
import { useDeleteService, useServices } from "@/features/services/hooks";
import type { ClinicService } from "@/features/services/types";

export default function ClinicServicesPage() {
  const services = useServices();
  const deleteMutation = useDeleteService();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClinicService>();
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [workflowService, setWorkflowService] = useState<ClinicService | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClinicService | null>(null);

  const filteredServices = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    if (!keyword) return services.data ?? [];
    return (services.data ?? []).filter((service) =>
      [service.code, service.name, service.description ?? ""].some((value) =>
        value.toLocaleLowerCase("vi").includes(keyword),
      ),
    );
  }, [search, services.data]);

  const configuredCount = services.data?.filter((service) => service.stepCount > 0).length ?? 0;

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (service: ClinicService) => {
    setEditing(service);
    setFormOpen(true);
  };

  const openWorkflow = (service: ClinicService) => {
    setWorkflowService(service);
    setWorkflowOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dịch vụ khám</h1>
          <p className="mt-1 text-sm text-slate-500">
            Xây dựng các quy trình khám và thứ tự phòng bệnh nhân cần đi qua.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Tạo dịch vụ
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-slate-100 p-2">
              <Sparkles className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Tổng dịch vụ</p>
              <p className="text-xl font-semibold text-slate-900">
                {services.isLoading ? "…" : services.data?.length ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-green-100 p-2">
              <GitBranch className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Đã có quy trình</p>
              <p className="text-xl font-semibold text-slate-900">
                {services.isLoading ? "…" : configuredCount}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-100 p-2">
              <CircleAlert className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Chưa có bước khám</p>
              <p className="text-xl font-semibold text-slate-900">
                {services.isLoading ? "…" : (services.data?.length ?? 0) - configuredCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Danh sách dịch vụ</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Dịch vụ cần ít nhất một bước trước khi dùng cho lượt khám.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo tên hoặc mã..."
              aria-label="Tìm dịch vụ khám"
              className="pl-9"
            />
          </div>
        </div>

        {services.isError ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3 p-6 text-center">
            <CircleAlert className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-sm font-medium text-slate-900">Không tải được dịch vụ khám</p>
              <p className="mt-1 text-xs text-slate-500">Vui lòng thử lại hoặc kiểm tra kết nối.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => services.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dịch vụ</TableHead>
                  <TableHead>Mô tả</TableHead>
                  <TableHead className="w-28">Quy trình</TableHead>
                  <TableHead className="w-56 text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                      Đang tải dịch vụ...
                    </TableCell>
                  </TableRow>
                )}

                {!services.isLoading && filteredServices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-40 text-center">
                      <div className="flex flex-col items-center">
                        <GitBranch className="h-8 w-8 text-slate-300" />
                        <p className="mt-2 text-sm font-medium text-slate-700">
                          {search ? "Không tìm thấy dịch vụ phù hợp" : "Chưa có dịch vụ khám nào"}
                        </p>
                        {!search && (
                          <Button variant="outline" size="sm" className="mt-3" onClick={openCreate}>
                            <Plus className="h-4 w-4" />
                            Tạo dịch vụ đầu tiên
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}

                {filteredServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <p className="font-medium text-slate-900">{service.name}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">{service.code}</p>
                    </TableCell>
                    <TableCell className="max-w-sm text-slate-600">
                      <p className="line-clamp-2">{service.description || "—"}</p>
                    </TableCell>
                    <TableCell>
                      {service.stepCount > 0 ? (
                        <Badge variant="success">{service.stepCount} bước</Badge>
                      ) : (
                        <Badge variant="warning">Chưa thiết kế</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => openWorkflow(service)}>
                          <GitBranch className="h-4 w-4" />
                          Thiết kế
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title={`Sửa dịch vụ ${service.name}`}
                          aria-label={`Sửa dịch vụ ${service.name}`}
                          onClick={() => openEdit(service)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title={`Xoá dịch vụ ${service.name}`}
                          aria-label={`Xoá dịch vụ ${service.name}`}
                          onClick={() => setDeleteTarget(service)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <ServiceFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        service={editing}
        onCreated={(created) => {
          setWorkflowService(created);
          setWorkflowOpen(true);
        }}
      />

      <ServiceWorkflowDialog
        open={workflowOpen}
        onOpenChange={setWorkflowOpen}
        service={workflowService}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(nextOpen) => !nextOpen && setDeleteTarget(null)}
        title="Xoá dịch vụ khám?"
        description={`Dịch vụ “${deleteTarget?.name ?? ""}” sẽ không còn xuất hiện để tạo lượt khám mới.`}
        confirmLabel="Xoá dịch vụ"
        isLoading={deleteMutation.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </div>
  );
}
