import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Response } from 'express';
import {
  REQUEST_ID_HEADER,
  RequestWithContext,
  resolveRequestId,
} from '../http/request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(
    request: RequestWithContext,
    response: Response,
    next: NextFunction,
  ): void {
    const requestId = resolveRequestId(request.headers[REQUEST_ID_HEADER]);
    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    next();
  }
}
