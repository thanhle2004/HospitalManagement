import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  getRequestId,
  RequestWithContext,
} from '../http/request-context';

export interface Response<T> {
  success: true;
  statusCode: number;
  requestId: string;
  timestamp: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    const http = context.switchToHttp();
    const statusCode = http.getResponse().statusCode;
    const requestId = getRequestId(http.getRequest<RequestWithContext>());

    return next.handle().pipe(
      map((data) => ({
        success: true,
        statusCode,
        requestId,
        timestamp: new Date().toISOString(),
        data,
      })),
    );
  }
}
