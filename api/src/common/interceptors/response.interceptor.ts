import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface SuccessResponseBody<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

interface PaginatedPayload<T> {
  items: T;
  meta: Record<string, unknown>;
}

function isPaginatedPayload<T>(
  payload: unknown,
): payload is PaginatedPayload<T> {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'items' in payload &&
    'meta' in payload
  );
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  SuccessResponseBody<T>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessResponseBody<T>> {
    return next.handle().pipe(
      map((payload) => {
        if (isPaginatedPayload<T>(payload)) {
          return { success: true, data: payload.items, meta: payload.meta };
        }
        return { success: true, data: payload };
      }),
    );
  }
}
