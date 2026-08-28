import Link from "next/link";
import { ArrowUpRight, ClipboardList, Stethoscope } from "lucide-react";
import type { PatientService } from "../types";

export function ServiceCard({ service }: { service: PatientService }) {
  return (
    <Link
      href={`/patient/services/${service.id}`}
      className="group block rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md"
    >
      <div className="flex items-start gap-3.5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-teal-50 text-teal-700">
          <Stethoscope className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-[15px] font-semibold leading-5 text-slate-900">{service.name}</h2>
            <ArrowUpRight className="size-4 shrink-0 text-slate-400 transition group-hover:text-teal-600" />
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
            {service.description || "Quy trình khám được điều phối phù hợp theo tình trạng phòng."}
          </p>
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
            <ClipboardList className="size-3.5" />
            {service.stepCount} bước khám
          </span>
        </div>
      </div>
    </Link>
  );
}
