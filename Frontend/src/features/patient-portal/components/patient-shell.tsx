"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Stethoscope, UserRound } from "lucide-react";
import { usePatientAuthStore } from "@/features/patient-auth/store";
import { cn } from "@/lib/utils";

const navigation = [
  { href: "/patient", label: "Trang chủ", icon: Home },
  { href: "/patient/services", label: "Dịch vụ", icon: Stethoscope },
  { href: "/patient/visits", label: "Lượt khám", icon: CalendarDays },
  { href: "/patient/profile", label: "Cá nhân", icon: UserRound },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/patient" ? pathname === href : pathname.startsWith(href);
}

export function PatientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const patient = usePatientAuthStore((state) => state.patient);
  const initial = patient?.fullName.trim().charAt(0).toUpperCase() || "B";

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900">
      <div className="mx-auto min-h-dvh max-w-xl bg-slate-50 shadow-[0_0_60px_rgba(15,23,42,0.08)]">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="flex h-11 items-center justify-between">
            <Link href="/patient" className="flex items-center gap-2.5" aria-label="Về trang chủ">
              <Image src="/logo.png" alt="Chilling Hospital Logo" width={36} height={36} className="size-9" priority />
              <span>
                <span className="block text-[15px] font-bold leading-4 tracking-tight text-sky-900">
                  Chilling Hospital
                </span>
                <span className="mt-0.5 block text-[10px] text-sky-600">
                  Smart Care, Chill Life
                </span>
              </span>
            </Link>
            <Link
              href="/patient/profile"
              className="grid size-9 place-items-center rounded-full bg-sky-100 text-sm font-bold text-sky-800 ring-2 ring-white"
              aria-label="Mở hồ sơ cá nhân"
            >
              {initial}
            </Link>
          </div>
        </header>

        <main className="min-h-[calc(100dvh-8rem)] px-4 pb-28 pt-5 sm:px-6">{children}</main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-xl border-t border-slate-200/80 bg-white/95 px-2 pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
          aria-label="Điều hướng bệnh nhân"
        >
          <div className="grid grid-cols-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            {navigation.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors",
                    active ? "bg-sky-100 text-sky-900" : "text-slate-500 hover:text-slate-800",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={cn("size-5", active && "stroke-[2.5]")} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
