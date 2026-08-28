"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { PatientPageHeader } from "@/features/patient-portal/components/patient-page-header";
import { PatientState } from "@/features/patient-portal/components/patient-state";
import { VisitCard } from "@/features/patient-portal/components/visit-card";
import { usePatientVisits } from "@/features/patient-portal/hooks";

type VisitFilter = "ACTIVE" | "HISTORY";

export default function PatientVisitsPage() {
  const [filter, setFilter] = useState<VisitFilter>("ACTIVE");
  const visits = usePatientVisits();
  const filtered = useMemo(() => {
    return [...(visits.data ?? [])]
      .filter((visit) =>
        filter === "ACTIVE"
          ? visit.status !== "COMPLETED" && visit.status !== "CANCELLED"
          : visit.status === "COMPLETED" || visit.status === "CANCELLED",
      )
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [filter, visits.data]);

  return (
    <div>
      <PatientPageHeader title="Lượt khám của tôi" description="Theo dõi tiến trình và xem lại các lượt khám trước đây." />
      <div className="mb-5 grid grid-cols-2 rounded-2xl bg-slate-100 p-1">
        {(["ACTIVE", "HISTORY"] as VisitFilter[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`h-10 rounded-xl text-sm font-semibold transition ${filter === value ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"}`}
          >
            {value === "ACTIVE" ? "Đang thực hiện" : "Lịch sử"}
          </button>
        ))}
      </div>

      {visits.isLoading ? (
        <PatientState variant="loading" description="Đang cập nhật lượt khám." />
      ) : visits.isError ? (
        <PatientState variant="error" description="Không thể lấy dữ liệu lượt khám lúc này." />
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-7 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-teal-50 text-teal-700"><CalendarPlus className="size-5" /></span>
          <h2 className="mt-3 text-sm font-semibold text-slate-900">{filter === "ACTIVE" ? "Bạn chưa có lượt khám đang thực hiện" : "Chưa có lịch sử khám"}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{filter === "ACTIVE" ? "Chọn một dịch vụ để bắt đầu quy trình khám." : "Lượt khám đã hoàn tất sẽ được lưu tại đây."}</p>
          {filter === "ACTIVE" ? <Link href="/patient/services" className="mt-4 inline-flex h-10 items-center rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white">Chọn dịch vụ</Link> : null}
        </div>
      ) : (
        <div className="space-y-3">{filtered.map((visit) => <VisitCard key={visit.id} visit={visit} />)}</div>
      )}
    </div>
  );
}
