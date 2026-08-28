import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import {
  PATIENT_ACCESS_COOKIE,
  PATIENT_REFRESH_COOKIE,
} from "@/features/patient-auth/cookies";
import { backendFetch } from "@/lib/server/backend-session";

const ACCESS_MAX_AGE = Number(
  process.env.PATIENT_ACCESS_COOKIE_MAX_AGE_SECONDS ?? 15 * 60,
);
const REFRESH_MAX_AGE = Number(
  process.env.PATIENT_REFRESH_COOKIE_MAX_AGE_SECONDS ?? 7 * 24 * 60 * 60,
);

export interface PatientTokens {
  accessToken: string;
  refreshToken: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  data?: T;
}

const pendingRefreshes = new Map<string, Promise<PatientTokens | null>>();

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    priority: "high" as const,
  };
}

export async function readPatientSessionCookies(): Promise<{
  accessToken?: string;
  refreshToken?: string;
}> {
  const cookieStore = await cookies();
  return {
    accessToken: cookieStore.get(PATIENT_ACCESS_COOKIE)?.value,
    refreshToken: cookieStore.get(PATIENT_REFRESH_COOKIE)?.value,
  };
}

export async function setPatientSessionCookies(tokens: PatientTokens): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PATIENT_ACCESS_COOKIE, tokens.accessToken, cookieOptions(ACCESS_MAX_AGE));
  cookieStore.set(PATIENT_REFRESH_COOKIE, tokens.refreshToken, cookieOptions(REFRESH_MAX_AGE));
}

export async function clearPatientSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(PATIENT_ACCESS_COOKIE, "", cookieOptions(0));
  cookieStore.set(PATIENT_REFRESH_COOKIE, "", cookieOptions(0));
}

async function rotateRefreshToken(refreshToken: string): Promise<PatientTokens | null> {
  const response = await backendFetch("/patient-auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) return null;

  try {
    const envelope = (await response.json()) as ApiEnvelope<PatientTokens>;
    return envelope.success && envelope.data ? envelope.data : null;
  } catch {
    return null;
  }
}

export async function refreshPatientSession(refreshToken: string): Promise<string | null> {
  const key = createHash("sha256").update(refreshToken).digest("hex");
  let pending = pendingRefreshes.get(key);
  if (!pending) {
    pending = rotateRefreshToken(refreshToken).finally(() => pendingRefreshes.delete(key));
    pendingRefreshes.set(key, pending);
  }

  const tokens = await pending;
  if (!tokens) {
    await clearPatientSessionCookies();
    return null;
  }

  await setPatientSessionCookies(tokens);
  return tokens.accessToken;
}
