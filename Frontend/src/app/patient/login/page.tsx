"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FirebaseError } from "firebase/app";
import {
  ConfirmationResult,
  inMemoryPersistence,
  RecaptchaVerifier,
  setPersistence,
  signInWithPhoneNumber,
  signOut,
  User,
} from "firebase/auth";
import { ArrowLeft, LockKeyhole, Phone, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  useCompletePatientRegistration,
  usePatientSessionBootstrap,
  useVerifyFirebasePhone,
} from "@/features/patient-auth/hooks";
import { usePatientAuthStore } from "@/features/patient-auth/store";
import { getFirebasePhoneAuth } from "@/lib/firebase-client";

const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

const phoneSchema = z.object({
  phone: z.string().trim().regex(phoneRegex, "Số điện thoại Việt Nam không hợp lệ"),
});
const otpSchema = z.object({
  otp: z.string().regex(/^\d{4,8}$/, "Mã OTP gồm 4–8 chữ số"),
});
const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "Vui lòng nhập đầy đủ họ tên"),
  gender: z.enum(["", "MALE", "FEMALE", "OTHER"]),
  birthday: z.string(),
  email: z.union([z.literal(""), z.string().email("Email không hợp lệ")]),
  address: z.string(),
  identityNumber: z.string(),
  emergencyContact: z.string(),
});

type PhoneValues = z.infer<typeof phoneSchema>;
type OtpValues = z.infer<typeof otpSchema>;
type RegistrationValues = z.infer<typeof registrationSchema>;

function errorText(error: unknown): string {
  if (error instanceof FirebaseError) {
    const messages: Record<string, string> = {
      "auth/invalid-phone-number": "Số điện thoại không hợp lệ",
      "auth/invalid-verification-code": "Mã OTP không đúng",
      "auth/code-expired": "Mã OTP đã hết hạn — vui lòng gửi lại mã",
      "auth/too-many-requests": "Đã gửi quá nhiều yêu cầu — vui lòng thử lại sau",
      "auth/quota-exceeded": "Firebase đã hết hạn mức gửi SMS của dự án",
      "auth/captcha-check-failed": "Không thể xác minh reCAPTCHA — vui lòng thử lại",
    };
    return messages[error.code] ?? "Firebase không thể xác thực số điện thoại";
  }
  return error instanceof ApiError ? error.message : "Có lỗi xảy ra, vui lòng thử lại";
}

function toFirebasePhone(phone: string): string {
  const trimmed = phone.trim();
  return trimmed.startsWith("0") ? `+84${trimmed.slice(1)}` : trimmed;
}

export default function PatientLoginPage() {
  const router = useRouter();
  usePatientSessionBootstrap();
  const initialized = usePatientAuthStore((state) => state.isInitialized);
  const patient = usePatientAuthStore((state) => state.patient);
  const [otpPhone, setOtpPhone] = useState<string | null>(null);
  const [registrationToken, setRegistrationToken] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isConfirmingOtp, setIsConfirmingOtp] = useState(false);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const verifyFirebasePhone = useVerifyFirebasePhone();
  const completeRegistration = useCompletePatientRegistration();

  const phoneForm = useForm<PhoneValues>({ resolver: zodResolver(phoneSchema) });
  const otpForm = useForm<OtpValues>({ resolver: zodResolver(otpSchema) });
  const registrationForm = useForm<RegistrationValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      fullName: "",
      gender: "",
      birthday: "",
      email: "",
      address: "",
      identityNumber: "",
      emergencyContact: "",
    },
  });

  useEffect(() => {
    if (initialized && patient) router.replace("/patient");
  }, [initialized, patient, router]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(
      () => setSecondsLeft((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  useEffect(() => {
    return () => {
      recaptchaVerifier?.clear();
    };
  }, [recaptchaVerifier]);

  const sendFirebaseOtp = async (phone: string) => {
    setFirebaseError(null);
    setIsSendingOtp(true);
    try {
      const auth = getFirebasePhoneAuth();
      await setPersistence(auth, inMemoryPersistence);
      if (auth.currentUser) await signOut(auth);
      recaptchaVerifier?.clear();
      const verifier = new RecaptchaVerifier(
        auth,
        "firebase-recaptcha-container",
        { size: "invisible" },
      );
      setRecaptchaVerifier(verifier);
      const confirmation = await signInWithPhoneNumber(
        auth,
        toFirebasePhone(phone),
        verifier,
      );
      setConfirmationResult(confirmation);
      setFirebaseUser(null);
      setOtpPhone(phone);
      setSecondsLeft(60);
    } catch (error) {
      recaptchaVerifier?.clear();
      setRecaptchaVerifier(null);
      setFirebaseError(errorText(error));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const sendOtp = ({ phone }: PhoneValues) => sendFirebaseOtp(phone);

  const verifyOtp = async ({ otp }: OtpValues) => {
    if (!otpPhone || !confirmationResult) return;
    setFirebaseError(null);
    setIsConfirmingOtp(true);
    try {
      const auth = getFirebasePhoneAuth();
      const verifiedUser = firebaseUser ?? (await confirmationResult.confirm(otp)).user;
      setFirebaseUser(verifiedUser);
      const firebaseIdToken = await verifiedUser.getIdToken(true);
      const result = await verifyFirebasePhone.mutateAsync({
        action: "VERIFY_FIREBASE_PHONE",
        firebaseIdToken,
      });
      await signOut(auth);
      if ("requiresRegistration" in result) {
        setRegistrationToken(result.registrationToken);
      }
    } catch (error) {
      setFirebaseError(errorText(error));
    } finally {
      setIsConfirmingOtp(false);
    }
  };

  const submitRegistration = (values: RegistrationValues) => {
    if (!registrationToken) return;
    completeRegistration.mutate({
      action: "COMPLETE_REGISTRATION",
      registrationToken,
      fullName: values.fullName.trim(),
      gender: values.gender || undefined,
      birthday: values.birthday || undefined,
      email: values.email || undefined,
      address: values.address || undefined,
      identityNumber: values.identityNumber || undefined,
      emergencyContact: values.emergencyContact || undefined,
    });
  };

  const resetPhone = () => {
    setOtpPhone(null);
    setRegistrationToken(null);
    setConfirmationResult(null);
    setFirebaseUser(null);
    setFirebaseError(null);
    setSecondsLeft(0);
    verifyFirebasePhone.reset();
    otpForm.reset();
    recaptchaVerifier?.clear();
    setRecaptchaVerifier(null);
    try {
      const auth = getFirebasePhoneAuth();
      if (auth.currentUser) void signOut(auth);
    } catch {
      // Firebase chưa cấu hình thì không có phiên client cần xoá.
    }
  };

  const resendOtp = async () => {
    if (!otpPhone || secondsLeft > 0) return;
    await sendFirebaseOtp(otpPhone);
  };

  const stage = registrationToken ? "REGISTER" : otpPhone ? "OTP" : "PHONE";

  return (
    <main className="min-h-dvh bg-slate-50 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3 pt-4">
          <Image src="/logo.png" alt="Chilling Hospital Logo" width={48} height={48} className="size-12" priority />
          <div>
            <p className="text-xl font-bold text-sky-900">Chilling Hospital</p>
            <p className="text-xs text-sky-600">Smart Care, Chill Life</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
          <div className="bg-gradient-to-br from-sky-700 to-sky-800 px-6 py-7 text-white">
            <span className="grid size-11 place-items-center rounded-2xl bg-white/15">
              {stage === "PHONE" ? <Phone className="size-5" /> : stage === "OTP" ? <LockKeyhole className="size-5" /> : <UserRound className="size-5" />}
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight">
              {stage === "PHONE" ? "Chào mừng bạn" : stage === "OTP" ? "Xác nhận số điện thoại" : "Hoàn thiện hồ sơ"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-sky-100">
              {stage === "PHONE"
                ? "Nhập số điện thoại để đăng nhập hoặc tạo hồ sơ bệnh nhân."
                : stage === "OTP"
                  ? `Mã OTP đã được gửi đến ${otpPhone}`
                  : "Số điện thoại này chưa có trong hệ thống. Vui lòng bổ sung thông tin để đăng ký."}
            </p>
          </div>

          <div className="p-5 sm:p-6">
            {stage === "PHONE" ? (
              <form onSubmit={phoneForm.handleSubmit(sendOtp)} className="space-y-5" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="patient-phone">Số điện thoại</Label>
                  <Input id="patient-phone" inputMode="tel" autoComplete="tel" placeholder="0901 234 567" className="h-12 rounded-xl text-base focus-visible:ring-sky-500" {...phoneForm.register("phone")} />
                  {phoneForm.formState.errors.phone ? <p className="text-xs text-red-600">{phoneForm.formState.errors.phone.message}</p> : <p className="text-xs text-slate-500">Hệ thống sẽ tự nhận biết bạn đã có hồ sơ hay chưa.</p>}
                </div>
                <p className="text-[11px] leading-5 text-slate-500">Firebase và Google có thể xử lý số điện thoại để gửi SMS và chống spam; cước SMS tiêu chuẩn có thể áp dụng.</p>
                {firebaseError ? <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{firebaseError}</p> : null}
                <Button id="firebase-phone-submit" type="submit" size="lg" className="w-full rounded-xl bg-sky-700 hover:bg-sky-800" isLoading={isSendingOtp}>Tiếp tục</Button>
              </form>
            ) : stage === "OTP" ? (
              <>
                <button type="button" onClick={resetPhone} className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"><ArrowLeft className="size-4" /> Đổi số điện thoại</button>
                <form onSubmit={otpForm.handleSubmit(verifyOtp)} className="space-y-5" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="patient-otp">Mã OTP</Label>
                    <Input id="patient-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="••••••" className="h-14 rounded-xl text-center text-xl font-bold tracking-[0.35em] focus-visible:ring-sky-500" {...otpForm.register("otp")} />
                    {otpForm.formState.errors.otp ? <p className="text-xs text-red-600">{otpForm.formState.errors.otp.message}</p> : null}
                  </div>
                  {firebaseError ? <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{firebaseError}</p> : null}
                  <Button type="submit" size="lg" className="w-full rounded-xl bg-sky-700 hover:bg-sky-800" isLoading={isConfirmingOtp || verifyFirebasePhone.isPending}>Xác nhận OTP</Button>
                </form>
                <div className="mt-5 text-center text-xs text-slate-500">
                  {secondsLeft > 0 ? <span>Gửi lại mã sau {secondsLeft}s</span> : <button type="button" className="font-semibold text-sky-700" onClick={resendOtp} disabled={isSendingOtp}>Gửi lại mã OTP</button>}
                </div>
              </>
            ) : (
              <form onSubmit={registrationForm.handleSubmit(submitRegistration)} className="space-y-4" noValidate>
                <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-xs leading-5 text-sky-800">Số điện thoại <strong>{otpPhone}</strong> đã được xác thực.</div>
                <div className="space-y-2">
                  <Label htmlFor="patient-full-name">Họ và tên <span className="text-red-500">*</span></Label>
                  <Input id="patient-full-name" autoComplete="name" className="h-11 rounded-xl" placeholder="Nguyễn Văn An" {...registrationForm.register("fullName")} />
                  {registrationForm.formState.errors.fullName ? <p className="text-xs text-red-600">{registrationForm.formState.errors.fullName.message}</p> : null}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label htmlFor="patient-gender">Giới tính</Label><Select id="patient-gender" className="h-11 rounded-xl" {...registrationForm.register("gender")}><option value="">Chưa chọn</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></Select></div>
                  <div className="space-y-2"><Label htmlFor="patient-birthday">Ngày sinh</Label><Input id="patient-birthday" type="date" className="h-11 rounded-xl px-2" {...registrationForm.register("birthday")} /></div>
                </div>
                <div className="space-y-2"><Label htmlFor="patient-email">Email</Label><Input id="patient-email" type="email" autoComplete="email" className="h-11 rounded-xl" placeholder="ban@email.com" {...registrationForm.register("email")} />{registrationForm.formState.errors.email ? <p className="text-xs text-red-600">{registrationForm.formState.errors.email.message}</p> : null}</div>
                <div className="space-y-2"><Label htmlFor="patient-identity">CCCD/CMND</Label><Input id="patient-identity" inputMode="numeric" className="h-11 rounded-xl" {...registrationForm.register("identityNumber")} /></div>
                <div className="space-y-2"><Label htmlFor="patient-address">Địa chỉ</Label><Input id="patient-address" autoComplete="street-address" className="h-11 rounded-xl" {...registrationForm.register("address")} /></div>
                <div className="space-y-2"><Label htmlFor="patient-emergency">Liên hệ khẩn cấp</Label><Input id="patient-emergency" inputMode="tel" className="h-11 rounded-xl" {...registrationForm.register("emergencyContact")} /></div>
                {completeRegistration.isError ? <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorText(completeRegistration.error)}</p> : null}
                <Button type="submit" size="lg" className="w-full rounded-xl bg-sky-700 hover:bg-sky-800" isLoading={completeRegistration.isPending}>Tạo hồ sơ bệnh nhân</Button>
              </form>
            )}
          </div>
        </section>

        <div id="firebase-recaptcha-container" />

        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-sky-100 bg-white p-3.5 text-xs leading-5 text-slate-600">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky-700" />
          Không chia sẻ mã OTP cho bất kỳ ai. Chilling Hospital không bao giờ yêu cầu bạn đọc mã qua điện thoại.
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Bạn là nhân viên? <Link href="/login" className="font-semibold text-sky-700">Đăng nhập hệ thống</Link></p>
      </div>
    </main>
  );
}
