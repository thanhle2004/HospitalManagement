"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useLogin, useSessionBootstrap } from "@/features/auth/hooks";
import { useAuthStore } from "@/features/auth/store";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const loginSchema = z.object({
  email: z.string().min(1, "Vui lòng nhập email").email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});
type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  useSessionBootstrap();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const user = useAuthStore((s) => s.user);
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  // Cookie HttpOnly còn phiên hợp lệ -> vào thẳng dashboard.
  useEffect(() => {
    if (isInitialized && user) {
      router.replace(user.role === "ADMIN" ? "/admin" : "/doctor");
    }
  }, [isInitialized, user, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Đăng nhập hệ thống</CardTitle>
          <p className="text-sm text-slate-500">HospitalManagement — dành cho Admin &amp; Doctor</p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((values) => login.mutate(values))}
            className="space-y-4"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="admin@hospital.local"
                {...register("email")}
              />
              {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Mật khẩu</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            {login.isError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {login.error instanceof ApiError
                  ? login.error.message
                  : "Đăng nhập thất bại — vui lòng thử lại"}
              </p>
            )}

            <Button type="submit" className="w-full" isLoading={login.isPending}>
              Đăng nhập
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
