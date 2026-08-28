"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { usePatientSessionBootstrap } from "../hooks";
import { usePatientAuthStore } from "../store";

export function PatientGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  usePatientSessionBootstrap();
  const isInitialized = usePatientAuthStore((state) => state.isInitialized);
  const patient = usePatientAuthStore((state) => state.patient);

  useEffect(() => {
    if (isInitialized && !patient) router.replace("/patient/login");
  }, [isInitialized, patient, router]);

  if (!isInitialized || !patient) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-sky-50 text-sky-800">
        <div className="flex flex-col items-center gap-3 text-sm font-medium">
          <span className="grid size-12 place-items-center rounded-2xl bg-white shadow-sm">
            <HeartPulse className="size-6 animate-pulse" />
          </span>
          Đang mở hồ sơ của bạn...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
