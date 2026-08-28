import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";

interface PatientStateProps {
  variant: "loading" | "error" | "empty";
  title?: string;
  description?: string;
}

export function PatientState({ variant, title, description }: PatientStateProps) {
  const Icon = variant === "loading" ? LoaderCircle : variant === "error" ? AlertCircle : Inbox;
  const defaultTitle =
    variant === "loading" ? "Đang tải dữ liệu" : variant === "error" ? "Không thể tải dữ liệu" : "Chưa có dữ liệu";

  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
        <Icon className={variant === "loading" ? "size-5 animate-spin" : "size-5"} />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title ?? defaultTitle}</p>
      {description ? <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">{description}</p> : null}
    </div>
  );
}
