import { NextResponse, type NextRequest } from "next/server";
import { STAFF_ACCESS_COOKIE, STAFF_REFRESH_COOKIE } from "@/features/auth/cookies";
import {
  PATIENT_ACCESS_COOKIE,
  PATIENT_REFRESH_COOKIE,
} from "@/features/patient-auth/cookies";

export function proxy(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/patient")) {
    if (request.nextUrl.pathname === "/patient/login") {
      return NextResponse.next();
    }

    const patientAccess = request.cookies.get(PATIENT_ACCESS_COOKIE)?.value;
    const patientRefresh = request.cookies.get(PATIENT_REFRESH_COOKIE)?.value;
    if (!patientAccess && !patientRefresh) {
      return NextResponse.redirect(new URL("/patient/login", request.url));
    }
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(STAFF_ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(STAFF_REFRESH_COOKIE)?.value;
  if (!accessToken && !refreshToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/doctor/:path*",
    "/workspace-unavailable",
    "/patient/:path*",
  ],
};
