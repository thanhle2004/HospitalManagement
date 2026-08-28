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
  setPatientSessionCookies,
  type PatientTokens,
} from "@/lib/server/patient-backend-session";

interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  data?: T;
}

type VerifyAction = "VERIFY_LOGIN" | "VERIFY_REGISTER";

async function currentPatient(accessToken: string): Promise<Response> {
  return backendFetch("/patients/me", {}, accessToken);
}

async function validAccessToken(): Promise<string | null> {
  const session = await readPatientSessionCookies();
  if (session.accessToken) return session.accessToken;
  if (!session.refreshToken) return null;
  return refreshPatientSession(session.refreshToken);
}

export async function GET(): Promise<Response> {
  const session = await readPatientSessionCookies();
  let accessToken = await validAccessToken();
  if (!accessToken) {
    return Response.json(
      { success: false, statusCode: 401, message: "Chưa đăng nhập" },
      { status: 401 },
    );
  }

  let response = await currentPatient(accessToken);
  if (response.status === 401 && session.refreshToken) {
    accessToken = (await refreshPatientSession(session.refreshToken)) ?? "";
    if (accessToken) response = await currentPatient(accessToken);
  }

  if (response.status === 401) await clearPatientSessionCookies();
  return copyBackendResponse(response);
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginMutation(request)) return forbiddenOriginResponse();

  let payload: Record<string, unknown> & { action?: VerifyAction };
  try {
    payload = (await request.json()) as Record<string, unknown> & { action?: VerifyAction };
  } catch {
    return Response.json(
      { success: false, statusCode: 400, message: "Dữ liệu không hợp lệ" },
      { status: 400 },
    );
  }

  const { action, ...credentials } = payload;
  const endpoint =
    action === "VERIFY_LOGIN"
      ? "/patient-auth/login/verify"
      : action === "VERIFY_REGISTER"
        ? "/patient-auth/register/verify"
        : null;
  if (!endpoint) {
    return Response.json(
      { success: false, statusCode: 400, message: "Thao tác không hợp lệ" },
      { status: 400 },
    );
  }

  const response = await backendFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (!response.ok) return copyBackendResponse(response);

  let envelope: ApiEnvelope<PatientTokens>;
  try {
    envelope = (await response.json()) as ApiEnvelope<PatientTokens>;
  } catch {
    return Response.json(
      { success: false, statusCode: 502, message: "Backend trả dữ liệu không hợp lệ" },
      { status: 502 },
    );
  }
  if (!envelope.success || !envelope.data) {
    return Response.json(envelope, { status: envelope.statusCode || 502 });
  }

  await setPatientSessionCookies(envelope.data);
  const profileResponse = await currentPatient(envelope.data.accessToken);
  if (!profileResponse.ok) await clearPatientSessionCookies();
  return copyBackendResponse(profileResponse);
}

export async function DELETE(request: Request): Promise<Response> {
  if (!isSameOriginMutation(request)) return forbiddenOriginResponse();

  const session = await readPatientSessionCookies();
  let accessToken = await validAccessToken();
  let response = accessToken
    ? await backendFetch("/patient-auth/logout", { method: "POST" }, accessToken)
    : new Response(null, { status: 204 });

  if (response.status === 401 && session.refreshToken) {
    accessToken = await refreshPatientSession(session.refreshToken);
    if (accessToken) {
      response = await backendFetch("/patient-auth/logout", { method: "POST" }, accessToken);
    }
  }

  await clearPatientSessionCookies();
  return copyBackendResponse(response);
}
