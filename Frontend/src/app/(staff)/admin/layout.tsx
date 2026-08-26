import { AuthGuard } from "@/components/layout/auth-guard";
import { StaffShell } from "@/components/layout/staff-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allow={["ADMIN"]}>
      <StaffShell>{children}</StaffShell>
    </AuthGuard>
  );
}
