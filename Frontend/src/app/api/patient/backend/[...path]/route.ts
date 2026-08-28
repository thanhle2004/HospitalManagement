import type { NextRequest } from "next/server";
import {
  backendFetch,
  copyBackendResponse,
  forbiddenOriginResponse,
  isSameOriginMutation,
} from "@/lib/server/backend-session";
import {
  clearPatientSessionCookies,
  readPatientSessionCookies,
  refreshPatientSession,
} from "@/lib/server/patient-backend-session";

type Context = { params: Promise<{ path: string[] }> };

const BLOCKED_TOKEN_PATHS = new Set([
  "patient-auth/login/verify",
  "patient-auth/register/verify",
  "patient-auth/refresh",
  "patient-auth/logout",
]);

async function handle(request: NextRequest, context: Context): Promise<Response> {
  if (!isSameOriginMutation(request)) return forbiddenOriginResponse();

  const { path } = await context.params;
  const normalizedPath = path.join("/");
  if (BLOCKED_TOKEN_PATHS.has(normalizedPath)) {
    return Response.json(
      { success: false, statusCode: 404, message: "Không tìm thấy endpoint" },
      { status: 404 },
    );
  }

  const backendPath = `/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const session = await readPatientSessionCookies();
  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.arrayBuffer();
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const requestId = request.headers.get("x-request-id");
  if (contentType) headers.set("Content-Type", contentType);
  if (requestId) headers.set("X-Request-Id", requestId);

  const send = (accessToken?: string) =>
    backendFetch(backendPath, { method: request.method, headers, body }, accessToken);

  let response = await send(session.accessToken);
  if (response.status === 401 && session.refreshToken) {
    const accessToken = await refreshPatientSession(session.refreshToken);
    if (accessToken) response = await send(accessToken);
  }

  if (response.status === 401) await clearPatientSessionCookies();
  return copyBackendResponse(response);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
