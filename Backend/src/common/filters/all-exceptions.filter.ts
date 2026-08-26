import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Đã xảy ra lỗi không xác định';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else {
        const body = res as Record<string, unknown>;
        // ZodValidationException (nestjs-zod) trả về:
        // { statusCode, message: "Validation failed", errors: ZodIssue[] }
        // Lấy chi tiết từng field thay vì chỉ message chung chung "Validation failed".
        if (Array.isArray(body.errors)) {
          message = (
            body.errors as { path: (string | number)[]; message: string }[]
          ).map((e) => `${e.path.join('.')}: ${e.message}`);
        } else {
          message = (body.message as string) ?? exception.message;
        }
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = `Giá trị cho trường [${(exception.meta?.target as string[])?.join(', ')}] đã tồn tại`;
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Không tìm thấy bản ghi';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = 'Dữ liệu tham chiếu (foreign key) không hợp lệ';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          message = `Lỗi cơ sở dữ liệu (${exception.code})`;
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Dữ liệu gửi lên không hợp lệ với schema';
    }

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
    });
  }
}
