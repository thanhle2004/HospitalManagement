import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface PatientPageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
}

export function PatientPageHeader({ title, description, backHref }: PatientPageHeaderProps) {
  return (
    <div className="mb-5 flex items-start gap-3">
      {backHref ? (
        <Link
          href={backHref}
          className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm"
          aria-label="Quay lại"
        >
          <ArrowLeft className="size-5" />
        </Link>
      ) : null}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-950">{title}</h1>
        {description ? <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p> : null}
      </div>
    </div>
  );
}
