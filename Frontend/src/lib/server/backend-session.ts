import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { STAFF_ACCESS_COOKIE, STAFF_REFRESH_COOKIE } from "@/features/auth/cookies";

const BACKEND_URL =
  process.env.BACKEND_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3000";
const ACCESS_MAX_AGE = Number(
  process.env.STAFF_ACCESS_COOKIE_MAX_AGE_SECONDS ?? 15 * 60,
);
const REFRESH_MAX_AGE = Number(
  process.env.STAFF_REFRESH_COOKIE_MAX_AGE_SECONDS ?? 7 * 24 * 60 * 60,
);

export interface StaffTokens {
  accessToken: string;
  refreshToken: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  data?: T;
}

const pendingRefreshes = new Map<string, Promise<StaffTokens | null>>();

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

export function backendUrl(path: string): string {
  return `${BACKEND_URL.replace(/\/$/, "")}${path}`;
}

export async function backendFetch(
  path: string,
  init: RequestInit = {},
  accessToken?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  return fetch(backendUrl(path), {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function readSessionCookies(): Promise<{
  accessToken?: string;
  refreshToken?: string;
}> {
  const cookieStore = await cookies();
  return {
    accessToken: cookieStore.get(STAFF_ACCESS_COOKIE)?.value,
    refreshToken: cookieStore.get(STAFF_REFRESH_COOKIE)?.value,
  };
}

export async function setSessionCookies(tokens: StaffTokens): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    STAFF_ACCESS_COOKIE,
    tokens.accessToken,
    cookieOptions(ACCESS_MAX_AGE),
  );
  cookieStore.set(
    STAFF_REFRESH_COOKIE,
    tokens.refreshToken,
    cookieOptions(REFRESH_MAX_AGE),
  );
}

export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STAFF_ACCESS_COOKIE, "", cookieOptions(0));
  cookieStore.set(STAFF_REFRESH_COOKIE, "", cookieOptions(0));
}

async function rotateRefreshToken(
  refreshToken: string,
): Promise<StaffTokens | null> {
  const response = await backendFetch("/api/v1/auth/sessions/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) return null;

  let envelope: ApiEnvelope<StaffTokens>;
  try {
    envelope = (await response.json()) as ApiEnvelope<StaffTokens>;
  } catch {
    return null;
  }

  return envelope.success && envelope.data ? envelope.data : null;
}

export async function refreshSession(
  refreshToken: string,
): Promise<string | null> {
  const key = createHash("sha256").update(refreshToken).digest("hex");
  let pending = pendingRefreshes.get(key);
  if (!pending) {
    pending = rotateRefreshToken(refreshToken).finally(() => {
      pendingRefreshes.delete(key);
    });
    pendingRefreshes.set(key, pending);
  }

  const tokens = await pending;
  if (!tokens) {
    await clearSessionCookies();
    return null;
  }

  // Mỗi request đang chờ phải tự gắn Set-Cookie vào response context của nó.
  await setSessionCookies(tokens);
  return tokens.accessToken;
}

export function isSameOriginMutation(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  return origin !== null && origin === new URL(request.url).origin;
}

export function copyBackendResponse(response: Response): Response {
  const headers = new Headers();
  const contentType = response.headers.get("content-type");
  const requestId = response.headers.get("x-request-id");
  if (contentType) headers.set("Content-Type", contentType);
  if (requestId) headers.set("X-Request-Id", requestId);

  return new Response(response.status === 204 ? null : response.body, {
    status: response.status,
    headers,
  });
}

export function forbiddenOriginResponse(): Response {
  return Response.json(
    {
      success: false,
      statusCode: 403,
      message: "Nguồn yêu cầu không hợp lệ",
    },
    { status: 403 },
  );
}
