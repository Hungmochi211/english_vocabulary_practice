import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details: unknown | null;
  } | null;
}

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiEnvelope<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiEnvelope<T>> {
    return next.handle().pipe(
      map((data) => {
        if (
          data &&
          typeof data === 'object' &&
          'success' in (data as Record<string, unknown>) &&
          'data' in (data as Record<string, unknown>) &&
          'error' in (data as Record<string, unknown>)
        ) {
          return data as unknown as ApiEnvelope<T>;
        }
        return {
          success: true,
          data: (data ?? null) as T | null,
          error: null,
        };
      }),
    );
  }
}
