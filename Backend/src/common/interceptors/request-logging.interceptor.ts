import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  getRequestId,
  RequestWithContext,
} from '../http/request-context';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const requestId = getRequestId(request);
    const baseLog = {
      event: 'http_request',
      requestId,
      method: request.method,
      controller: context.getClass().name,
      handler: context.getHandler().name,
    };

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            JSON.stringify({
              ...baseLog,
              statusCode: response.statusCode,
              durationMs: Date.now() - startedAt,
            }),
          );
        },
        error: (error: unknown) => {
          const statusCode =
            error instanceof HttpException ? error.getStatus() : 500;
          this.logger.warn(
            JSON.stringify({
              ...baseLog,
              statusCode,
              durationMs: Date.now() - startedAt,
              outcome: 'error',
            }),
          );
        },
      }),
    );
  }
}
