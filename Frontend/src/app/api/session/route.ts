import {
  backendFetch,
  clearSessionCookies,
  copyBackendResponse,
  forbiddenOriginResponse,
  isSameOriginMutation,
  readSessionCookies,
  refreshSession,
  setSessionCookies,
  type StaffTokens,
} from "@/lib/server/backend-session";

interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  data?: T;
}

async function currentSession(accessToken: string): Promise<Response> {
  return backendFetch("/api/v1/auth/sessions/current", {}, accessToken);
}

export async function GET(): Promise<Response> {
  const session = await readSessionCookies();
  let accessToken = session.accessToken;

  if (!accessToken && session.refreshToken) {
    accessToken = (await refreshSession(session.refreshToken)) ?? undefined;
  }
  if (!accessToken) {
    return Response.json(
      { success: false, statusCode: 401, message: "Chưa đăng nhập" },
      { status: 401 },
    );
  }

  let response = await currentSession(accessToken);
  if (response.status === 401 && session.refreshToken) {
    const refreshedAccessToken = await refreshSession(session.refreshToken);
    if (refreshedAccessToken) {
      response = await currentSession(refreshedAccessToken);
    }
  }

  if (response.status === 401) await clearSessionCookies();
  return copyBackendResponse(response);
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginMutation(request)) return forbiddenOriginResponse();

  const response = await backendFetch("/api/v1/auth/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
  if (!response.ok) return copyBackendResponse(response);

  let envelope: ApiEnvelope<StaffTokens>;
  try {
    envelope = (await response.json()) as ApiEnvelope<StaffTokens>;
  } catch {
    return Response.json(
      { success: false, statusCode: 502, message: "Backend trả dữ liệu không hợp lệ" },
      { status: 502 },
    );
  }
  if (!envelope.success || !envelope.data) {
    return Response.json(envelope, { status: envelope.statusCode || 502 });
  }

  await setSessionCookies(envelope.data);
  const current = await currentSession(envelope.data.accessToken);
  if (!current.ok) await clearSessionCookies();
  return copyBackendResponse(current);
}

export async function DELETE(request: Request): Promise<Response> {
  if (!isSameOriginMutation(request)) return forbiddenOriginResponse();

  const session = await readSessionCookies();
  let accessToken = session.accessToken;
  if (!accessToken && session.refreshToken) {
    accessToken = (await refreshSession(session.refreshToken)) ?? undefined;
  }

  let response = accessToken
    ? await backendFetch(
        "/api/v1/auth/sessions/current",
        { method: "DELETE" },
        accessToken,
      )
    : new Response(null, { status: 204 });

  if (response.status === 401 && session.refreshToken) {
    const refreshedAccessToken = await refreshSession(session.refreshToken);
    if (refreshedAccessToken) {
      response = await backendFetch(
        "/api/v1/auth/sessions/current",
        { method: "DELETE" },
        refreshedAccessToken,
      );
    }
  }

  await clearSessionCookies();
  return copyBackendResponse(response);
}
