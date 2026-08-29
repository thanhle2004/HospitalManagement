import { AuthGuard } from "@/components/layout/auth-guard";
import { DoctorShell } from "@/components/layout/doctor-shell";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allow={["DOCTOR"]}>
      <DoctorShell>{children}</DoctorShell>
    </AuthGuard>
  );
}
