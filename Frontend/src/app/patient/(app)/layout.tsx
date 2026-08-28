import { PatientGuard } from "@/features/patient-auth/components/patient-guard";
import { PatientShell } from "@/features/patient-portal/components/patient-shell";

export default function PatientAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PatientGuard>
      <PatientShell>{children}</PatientShell>
    </PatientGuard>
  );
}
