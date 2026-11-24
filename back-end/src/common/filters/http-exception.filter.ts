import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

const STATUS_DEFAULT_CODE: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Hệ thống tạm thời gặp sự cố, vui lòng thử lại sau ít phút';
    let details: unknown | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (typeof resObj.code === 'string') {
          code = resObj.code;
        } else {
          code = STATUS_DEFAULT_CODE[status] ?? 'INTERNAL_SERVER_ERROR';
        }

        if (code === 'VALIDATION_ERROR') {
          message = 'Dữ liệu gửi lên không hợp lệ';
          if (Array.isArray(resObj.message)) {
            details = resObj.message;
          } else if (resObj.details !== undefined && resObj.details !== null) {
            details = resObj.details;
          } else if (typeof resObj.message === 'string') {
            details = [resObj.message];
          } else {
            details = ['Validation failed'];
          }
        } else {
          if (typeof resObj.message === 'string') {
            message = resObj.message;
          } else if (Array.isArray(resObj.message) && resObj.message.length > 0) {
            message = String(resObj.message[0]);
          }
          details = resObj.details ?? null;
        }
      } else if (typeof res === 'string') {
        code = STATUS_DEFAULT_CODE[status] ?? 'INTERNAL_SERVER_ERROR';
        message = res;
      }
    } else if (exception instanceof Error) {
      // PostgreSQL / Redis / external connection errors -> 503 SERVICE_UNAVAILABLE without leaking internals
      const msg = exception.message || '';
      const errCode = (exception as unknown as { code?: string }).code || '';
      if (
        errCode.startsWith('08') ||
        errCode === '57P01' ||
        errCode === 'ECONNREFUSED' ||
        errCode === 'ETIMEDOUT' ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('Connection is closed') ||
        msg.includes('Redis')
      ) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        code = 'SERVICE_UNAVAILABLE';
        message = 'Dịch vụ tạm thời gián đoạn, vui lòng thử lại sau ít phút';
      }
    }

    response.status(status).json({
      success: false,
      data: null,
      error: {
        code,
        message,
        details,
      },
    });
  }
}
