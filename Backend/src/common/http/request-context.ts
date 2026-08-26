import { randomUUID } from 'crypto';
import { Request } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export type RequestWithContext = Request & {
  requestId?: string;
};

export function resolveRequestId(value: unknown): string {
  if (typeof value === 'string' && REQUEST_ID_PATTERN.test(value)) {
    return value;
  }

  return randomUUID();
}

export function getRequestId(request: RequestWithContext): string {
  return request.requestId ?? resolveRequestId(undefined);
}
