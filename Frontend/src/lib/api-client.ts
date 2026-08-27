/**
 * Backend (NestJS) bọc mọi response thành công qua TransformInterceptor:
 *   { success: true, statusCode, timestamp, data: T }
 * và mọi lỗi qua AllExceptionsFilter:
 *   { success: false, statusCode, path, timestamp, message: string | string[] }
 * Client chỉ gọi Route Handler cùng origin của Next.js. Access/refresh token
 * nằm trong cookie HttpOnly và việc rotate token diễn ra hoàn toàn ở server.
 */

import { useAuthStore } from "@/features/auth/store";

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

async function rawRequest(url: string, options: RequestInit): Promise<Response> {
  return fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

export async function envelopeFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await rawRequest(url, options);
  let body: ApiEnvelope<T>;
  try {
    body = response.status === 204 ? { success: true, statusCode: 204 } : await response.json();
  } catch {
    throw new ApiError(response.status, "Không đọc được phản hồi từ server");
  }

  if (!response.ok || !body.success) {
    if (response.status === 401) useAuthStore.getState().clearAuth();
    throw new ApiError(body.statusCode ?? response.status, toMessage(body.message, "Có lỗi xảy ra"));
  }

  return body.data as T;
}

export function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  return envelopeFetch<T>(`/api/backend${path}`, options);
}
