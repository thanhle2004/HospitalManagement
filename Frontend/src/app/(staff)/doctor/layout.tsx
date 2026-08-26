import { AuthGuard } from "@/components/layout/auth-guard";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard allow={["DOCTOR"]}>{children}</AuthGuard>;
}
