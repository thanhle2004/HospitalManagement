"use client";

import { useMemo, useState } from "react";
import { Search, Stethoscope } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PatientPageHeader } from "@/features/patient-portal/components/patient-page-header";
import { PatientState } from "@/features/patient-portal/components/patient-state";
import { ServiceCard } from "@/features/patient-portal/components/service-card";
import { usePatientServices } from "@/features/patient-portal/hooks";

export default function PatientServicesPage() {
  const [search, setSearch] = useState("");
  const services = usePatientServices();
  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("vi");
    if (!keyword) return services.data ?? [];
    return (services.data ?? []).filter((service) =>
      `${service.name} ${service.description ?? ""}`.toLocaleLowerCase("vi").includes(keyword),
    );
  }, [search, services.data]);

  return (
    <div>
      <PatientPageHeader title="Dịch vụ khám" description="Xem trước quy trình và chọn dịch vụ phù hợp với bạn." />
      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm dịch vụ khám..."
          className="h-12 rounded-2xl border-slate-200 bg-white pl-10 shadow-sm"
        />
      </div>

      {services.isLoading ? (
        <PatientState variant="loading" description="Đang tải danh sách dịch vụ khám." />
      ) : services.isError ? (
        <PatientState variant="error" description="Vui lòng kiểm tra kết nối và thử lại." />
      ) : filtered.length === 0 ? (
        <PatientState
          variant="empty"
          title={search ? "Không tìm thấy dịch vụ" : "Chưa có dịch vụ khám"}
          description={search ? "Hãy thử một từ khoá khác." : "Danh sách sẽ xuất hiện khi bệnh viện cập nhật dịch vụ."}
        />
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <Stethoscope className="size-4 text-sky-600" />
            {filtered.length} dịch vụ đang hoạt động
          </div>
          <div className="space-y-3">{filtered.map((service) => <ServiceCard key={service.id} service={service} />)}</div>
        </>
      )}
    </div>
  );
}
