import { StaffHeader } from "./staff-header";

export function DoctorShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <StaffHeader showSearch={false} />
      <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
