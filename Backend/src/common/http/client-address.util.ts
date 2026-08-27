import type { Request } from 'express';

export function getClientAddress(request: Request): string {
  return request.ip || request.socket.remoteAddress || 'unknown';
}
