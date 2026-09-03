import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

function isAlreadyEnveloped(data: unknown): data is { success: boolean } {
  if (!data || typeof data !== 'object' || !('success' in data)) {
    return false;
  }

  return typeof data.success === 'boolean';
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        if (isAlreadyEnveloped(data)) {
          return data;
        }

        return {
          success: true,
          data: data ?? null,
        };
      }),
    );
  }
}
