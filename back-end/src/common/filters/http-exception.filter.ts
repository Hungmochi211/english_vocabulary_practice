import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'Đã xảy ra lỗi hệ thống';
    let details: unknown | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        if (typeof resObj.code === 'string') {
          code = resObj.code;
        } else if (status === HttpStatus.BAD_REQUEST) {
          code = 'VALIDATION_ERROR';
        } else if (status === HttpStatus.NOT_FOUND) {
          code = 'NOT_FOUND';
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
          }
          details = null;
        }
      } else if (typeof res === 'string') {
        message = res;
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
