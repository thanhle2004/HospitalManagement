import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock3, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime, shortVisitId, visitStatusLabel } from "../format";
import type { PatientVisit, VisitStatus } from "../types";

const statusStyles: Record<VisitStatus, string> = {
  CREATED: "bg-slate-100 text-slate-700",
  WAITING: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-sky-100 text-sky-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-700",
};

export function VisitStatusPill({ status }: { status: VisitStatus }) {
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold", statusStyles[status])}>
      {visitStatusLabel[status]}
    </span>
  );
}

export function VisitCard({ visit, highlighted = false }: { visit: PatientVisit; highlighted?: boolean }) {
  const ActiveIcon = visit.status === "COMPLETED" ? CheckCircle2 : visit.status === "IN_PROGRESS" ? Stethoscope : Clock3;

  return (
    <Link
      href={`/patient/visits/${visit.id}`}
      className={cn(
        "block rounded-3xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        highlighted ? "border-sky-200 bg-gradient-to-br from-sky-600 to-sky-700 text-white" : "border-slate-200/80 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("grid size-11 place-items-center rounded-2xl", highlighted ? "bg-white/15" : "bg-sky-50 text-sky-700")}>
          <ActiveIcon className="size-5" />
        </span>
        {highlighted ? (
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white">
            {visitStatusLabel[visit.status]}
          </span>
        ) : (
          <VisitStatusPill status={visit.status} />
        )}
      </div>
      <p className={cn("mt-4 text-[15px] font-semibold", highlighted ? "text-white" : "text-slate-900")}>
        {visit.flow.name}
      </p>
      <div className={cn("mt-1.5 flex items-center justify-between gap-3 text-xs", highlighted ? "text-sky-50" : "text-slate-500")}>
        <span>Mã lượt: {shortVisitId(visit.id)}</span>
        <span>{formatDateTime(visit.createdAt)}</span>
      </div>
      <div className={cn("mt-4 flex items-center justify-between border-t pt-3 text-xs font-semibold", highlighted ? "border-white/20 text-white" : "border-slate-100 text-sky-700")}>
        Xem tiến trình
        <ArrowRight className="size-4" />
      </div>
    </Link>
  );
}
