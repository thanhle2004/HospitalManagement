"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, HeartPulse, LockKeyhole, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  useOtpChallenge,
  usePatientSessionBootstrap,
  useVerifyPatientLogin,
  useVerifyPatientRegister,
} from "@/features/patient-auth/hooks";
import { usePatientAuthStore } from "@/features/patient-auth/store";

const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

const phoneSchema = z.object({
  phone: z.string().trim().regex(phoneRegex, "Số điện thoại Việt Nam không hợp lệ"),
});

const loginVerifySchema = z.object({
  otp: z.string().regex(/^\d{4,8}$/, "Mã OTP gồm 4–8 chữ số"),
});

const registerVerifySchema = z.object({
  otp: z.string().regex(/^\d{4,8}$/, "Mã OTP gồm 4–8 chữ số"),
  fullName: z.string().trim().min(2, "Vui lòng nhập đầy đủ họ tên"),
  gender: z.enum(["", "MALE", "FEMALE", "OTHER"]),
  birthday: z.string(),
  email: z.union([z.literal(""), z.string().email("Email không hợp lệ")]),
  address: z.string(),
});

type Mode = "LOGIN" | "REGISTER";
type PhoneValues = z.infer<typeof phoneSchema>;
type LoginVerifyValues = z.infer<typeof loginVerifySchema>;
type RegisterVerifyValues = z.infer<typeof registerVerifySchema>;

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại";
}

export default function PatientLoginPage() {
  const router = useRouter();
  usePatientSessionBootstrap();
  const initialized = usePatientAuthStore((state) => state.isInitialized);
  const patient = usePatientAuthStore((state) => state.patient);
  const [mode, setMode] = useState<Mode>("LOGIN");
  const [otpPhone, setOtpPhone] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const requestOtp = useOtpChallenge();
  const verifyLogin = useVerifyPatientLogin();
  const verifyRegister = useVerifyPatientRegister();

  const phoneForm = useForm<PhoneValues>({ resolver: zodResolver(phoneSchema) });
  const loginForm = useForm<LoginVerifyValues>({ resolver: zodResolver(loginVerifySchema) });
  const registerForm = useForm<RegisterVerifyValues>({
    resolver: zodResolver(registerVerifySchema),
    defaultValues: { otp: "", fullName: "", gender: "", birthday: "", email: "", address: "" },
  });

  useEffect(() => {
    if (initialized && patient) router.replace("/patient");
  }, [initialized, patient, router]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setOtpPhone(null);
    setSecondsLeft(0);
    requestOtp.reset();
    loginForm.reset();
    registerForm.reset({ otp: "", fullName: "", gender: "", birthday: "", email: "", address: "" });
  };

  const sendOtp = async ({ phone }: PhoneValues) => {
    try {
      await requestOtp.mutateAsync({ phone, purpose: mode });
      setOtpPhone(phone);
      setSecondsLeft(60);
    } catch {
      // Hiển thị lỗi từ mutation ngay trong form.
    }
  };

  const resendOtp = async () => {
    if (!otpPhone || secondsLeft > 0) return;
    try {
      await requestOtp.mutateAsync({ phone: otpPhone, purpose: mode });
      setSecondsLeft(60);
    } catch {
      // Hiển thị lỗi từ mutation ngay trong form.
    }
  };

  return (
    <main className="min-h-dvh bg-[#eef7f5] px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2.5 pt-4">
          <span className="grid size-11 place-items-center rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-200">
            <HeartPulse className="size-6" />
          </span>
          <div>
            <p className="font-bold tracking-tight text-slate-950">HospitalCare</p>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-teal-700">Cổng bệnh nhân</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-xl shadow-teal-900/5">
          <div className="bg-gradient-to-br from-teal-600 to-teal-700 px-6 py-7 text-white">
            <span className="grid size-11 place-items-center rounded-2xl bg-white/15">
              {otpPhone ? <LockKeyhole className="size-5" /> : <Phone className="size-5" />}
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">
              {otpPhone ? "Nhập mã xác thực" : "Chăm sóc sức khoẻ dễ dàng hơn"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-teal-50">
              {otpPhone
                ? `Mã OTP đã được gửi đến ${otpPhone}`
                : "Đăng nhập bằng số điện thoại để đăng ký và theo dõi lượt khám."}
            </p>
          </div>

          <div className="p-5 sm:p-6">
            {!otpPhone ? (
              <>
                <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                  {(["LOGIN", "REGISTER"] as Mode[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`h-10 rounded-lg text-sm font-semibold transition ${
                        mode === value ? "bg-white text-teal-700 shadow-sm" : "text-slate-500"
                      }`}
                      onClick={() => switchMode(value)}
                    >
                      {value === "LOGIN" ? "Đăng nhập" : "Đăng ký mới"}
                    </button>
                  ))}
                </div>

                <form onSubmit={phoneForm.handleSubmit(sendOtp)} className="mt-6 space-y-5" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="patient-phone">Số điện thoại</Label>
                    <Input
                      id="patient-phone"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="0901 234 567"
                      className="h-12 rounded-xl text-base"
                      {...phoneForm.register("phone")}
                    />
                    {phoneForm.formState.errors.phone ? (
                      <p className="text-xs text-red-600">{phoneForm.formState.errors.phone.message}</p>
                    ) : (
                      <p className="text-xs text-slate-500">Chúng tôi sẽ gửi mã OTP để xác thực.</p>
                    )}
                  </div>

                  {requestOtp.isError ? (
                    <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
                      {errorText(requestOtp.error)}
                    </p>
                  ) : null}

                  <Button type="submit" size="lg" className="w-full rounded-xl bg-teal-600 hover:bg-teal-700" isLoading={requestOtp.isPending}>
                    Gửi mã OTP
                  </Button>
                </form>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setOtpPhone(null)}
                  className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"
                >
                  <ArrowLeft className="size-4" />
                  Đổi số điện thoại
                </button>

                {mode === "LOGIN" ? (
                  <form
                    onSubmit={loginForm.handleSubmit((values) =>
                      verifyLogin.mutate({ action: "VERIFY_LOGIN", phone: otpPhone, otp: values.otp }),
                    )}
                    className="space-y-5"
                    noValidate
                  >
                    <div className="space-y-2">
                      <Label htmlFor="login-otp">Mã OTP</Label>
                      <Input
                        id="login-otp"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={8}
                        placeholder="••••••"
                        className="h-14 rounded-xl text-center text-xl font-bold tracking-[0.35em]"
                        {...loginForm.register("otp")}
                      />
                      {loginForm.formState.errors.otp ? (
                        <p className="text-xs text-red-600">{loginForm.formState.errors.otp.message}</p>
                      ) : null}
                    </div>
                    {verifyLogin.isError ? (
                      <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorText(verifyLogin.error)}</p>
                    ) : null}
                    <Button type="submit" size="lg" className="w-full rounded-xl bg-teal-600 hover:bg-teal-700" isLoading={verifyLogin.isPending}>
                      Xác nhận đăng nhập
                    </Button>
                  </form>
                ) : (
                  <form
                    onSubmit={registerForm.handleSubmit((values) =>
                      verifyRegister.mutate({
                        action: "VERIFY_REGISTER",
                        phone: otpPhone,
                        otp: values.otp,
                        fullName: values.fullName.trim(),
                        gender: values.gender || undefined,
                        birthday: values.birthday || undefined,
                        email: values.email || undefined,
                        address: values.address || undefined,
                      }),
                    )}
                    className="space-y-4"
                    noValidate
                  >
                    <div className="space-y-2">
                      <Label htmlFor="register-otp">Mã OTP</Label>
                      <Input id="register-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="••••••" className="h-14 rounded-xl text-center text-xl font-bold tracking-[0.35em]" {...registerForm.register("otp")} />
                      {registerForm.formState.errors.otp ? <p className="text-xs text-red-600">{registerForm.formState.errors.otp.message}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="patient-full-name">Họ và tên</Label>
                      <Input id="patient-full-name" autoComplete="name" className="h-11 rounded-xl" placeholder="Nguyễn Văn An" {...registerForm.register("fullName")} />
                      {registerForm.formState.errors.fullName ? <p className="text-xs text-red-600">{registerForm.formState.errors.fullName.message}</p> : null}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="patient-gender">Giới tính</Label>
                        <Select id="patient-gender" className="h-11 rounded-xl" {...registerForm.register("gender")}>
                          <option value="">Chưa chọn</option>
                          <option value="MALE">Nam</option>
                          <option value="FEMALE">Nữ</option>
                          <option value="OTHER">Khác</option>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="patient-birthday">Ngày sinh</Label>
                        <Input id="patient-birthday" type="date" className="h-11 rounded-xl px-2" {...registerForm.register("birthday")} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="patient-email">Email (tuỳ chọn)</Label>
                      <Input id="patient-email" type="email" autoComplete="email" className="h-11 rounded-xl" placeholder="ban@email.com" {...registerForm.register("email")} />
                      {registerForm.formState.errors.email ? <p className="text-xs text-red-600">{registerForm.formState.errors.email.message}</p> : null}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="patient-address">Địa chỉ (tuỳ chọn)</Label>
                      <Input id="patient-address" autoComplete="street-address" className="h-11 rounded-xl" {...registerForm.register("address")} />
                    </div>
                    {verifyRegister.isError ? <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorText(verifyRegister.error)}</p> : null}
                    <Button type="submit" size="lg" className="w-full rounded-xl bg-teal-600 hover:bg-teal-700" isLoading={verifyRegister.isPending}>
                      Hoàn tất đăng ký
                    </Button>
                  </form>
                )}

                <div className="mt-5 text-center text-xs text-slate-500">
                  {secondsLeft > 0 ? (
                    <span>Gửi lại mã sau {secondsLeft}s</span>
                  ) : (
                    <button type="button" className="font-semibold text-teal-700" onClick={resendOtp} disabled={requestOtp.isPending}>
                      Gửi lại mã OTP
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-teal-100 bg-white/70 p-3.5 text-xs leading-5 text-slate-600">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-700" />
          Phiên đăng nhập được bảo vệ trên thiết bị này. Không chia sẻ mã OTP cho bất kỳ ai.
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          Bạn là nhân viên? <Link href="/login" className="font-semibold text-teal-700">Đăng nhập hệ thống</Link>
        </p>
      </div>
    </main>
  );
}
