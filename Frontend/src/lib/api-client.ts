/**
 * Backend (NestJS) bọc mọi response thành công qua TransformInterceptor:
 *   { success: true, statusCode, timestamp, data: T }
 * và mọi lỗi qua AllExceptionsFilter:
 *   { success: false, statusCode, path, timestamp, message: string | string[] }
 * Client này tự bóc `data`, và tự thử refresh access token đúng 1 lần khi
 * gặp 401 trước khi coi là thất bại thật.
 */

import { useAuthStore } from "@/features/auth/store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  statusCode: number;
  data?: T;
  message?: string | string[];
}

function toMessage(message: string | string[] | undefined, fallback: string): string {
  if (!message) return fallback;
  return Array.isArray(message) ? message.join("; ") : message;
}

async function rawRequest(path: string, options: RequestInit, token: string | null): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

// Nhiều request 401 cùng lúc chỉ nên trigger refresh 1 lần — gộp lại chung 1 promise
let pendingRefresh: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;

  try {
    const res = await rawRequest(
      "/auth/refresh",
      { method: "POST", body: JSON.stringify({ refreshToken }) },
      null,
    );
    if (!res.ok) return null;

    const body: ApiEnvelope<{ accessToken: string; refreshToken: string }> = await res.json();
    if (!body.success || !body.data) return null;

    useAuthStore.getState().setTokens(body.data.accessToken, body.data.refreshToken);
    return body.data.accessToken;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const accessToken = useAuthStore.getState().accessToken;
  let response = await rawRequest(path, options, accessToken);

  if (response.status === 401 && useAuthStore.getState().refreshToken) {
    pendingRefresh ??= refreshAccessToken().finally(() => {
      pendingRefresh = null;
    });
    const newAccessToken = await pendingRefresh;

    if (newAccessToken) {
      response = await rawRequest(path, options, newAccessToken);
    } else {
      useAuthStore.getState().clearAuth();
      throw new ApiError(401, "Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại");
    }
  }

  let body: ApiEnvelope<T>;
  try {
    body = response.status === 204 ? { success: true, statusCode: 204 } : await response.json();
  } catch {
    throw new ApiError(response.status, "Không đọc được phản hồi từ server");
  }

  if (!response.ok || !body.success) {
    throw new ApiError(body.statusCode ?? response.status, toMessage(body.message, "Có lỗi xảy ra"));
  }

  return body.data as T;
}
