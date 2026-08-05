import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AuthenticatedUser } from '../auth/interfaces/authenticatedUser.interface';

import { AuditLogService } from './auditLog.service';
import { AUDIT_KEY, AuditMetadata } from './decorators/audit.decorator';

interface AuditableRequest {
  user?: AuthenticatedUser;
  params: Record<string, string>;
  body: unknown;
}

// Fields that must never be persisted into audit metadata in the clear,
// wherever they show up in a request body — e.g. CreateUserDto.password.
// This is a generic interceptor that captures whatever body a decorated
// endpoint receives, so redaction happens here once rather than trusting
// every future @Audit()-decorated endpoint to remember to scrub its own
// sensitive fields.
const REDACTED_FIELDS = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'passwordHash',
]);
const REDACTED_PLACEHOLDER = '[redacted]';

// Generic, interceptor-based audit trail — applied globally (registered as
// APP_INTERCEPTOR in auditLog.module.ts), not hand-added logging calls
// sprinkled through every service. Only endpoints decorated with @Audit()
// produce a log entry; everything else passes through untouched. See
// docs/phases/PHASE_11_AUDIT_LOG.md.
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const audit = this.reflector.get<AuditMetadata | undefined>(
      AUDIT_KEY,
      context.getHandler(),
    );
    if (!audit) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditableRequest>();

    // tap's success callback only fires when the handler actually emits a
    // value — a thrown exception skips it entirely, so a failed request
    // (e.g. the loan creation guard rejecting a mora-blocked client)
    // never produces a misleading "success" log entry, with no extra
    // error-handling needed here.
    return next.handle().pipe(
      tap((response) => {
        // Fire-and-forget: a failed audit write must never fail the actual
        // request it's trying to record. Same principle as
        // sendNewLoanMessageSafely in loans.service.ts — log the error,
        // don't throw.
        void this.auditLogService
          .record({
            actorUserId: request.user?.id ?? null,
            action: audit.action,
            entityType: audit.entityType,
            entityId: this.resolveEntityId(request.params, response),
            metadata: {
              params: request.params,
              body: this.redact(request.body),
            },
          })
          .catch((error: unknown) => {
            this.logger.error(
              `Failed to write audit log entry for action "${audit.action}"`,
              error,
            );
          });
      }),
    );
  }

  // Prefers the id on whatever the handler actually returned — this is the
  // entity the action produced or affected, and for most endpoints that's
  // the same value as the route's own :id anyway (update/deactivate/
  // reactivate/markAsPaid all return the same record they were called on).
  // It matters for the cases where it *isn't* the same: POST
  // /installments/:id/payments's :id is the INSTALLMENT, not the payment
  // being logged (entityType 'payment') — using the response's id avoids
  // logging the wrong entity there. Falls back to params.id only when the
  // response has no extractable id (e.g. a 204 No Content delete). Checked
  // defensively in both the raw-entity and ResponseInterceptor-wrapped
  // ({ data: {...} }) shapes: this interceptor's exact position relative
  // to ResponseInterceptor in the global chain isn't something to depend on.
  private resolveEntityId(
    params: Record<string, string>,
    response: unknown,
  ): string | null {
    const direct = this.extractId(response);
    if (direct) {
      return direct;
    }

    if (typeof response === 'object' && response !== null) {
      const data = (response as Record<string, unknown>).data;
      const nested = this.extractId(data);
      if (nested) {
        return nested;
      }
    }

    return params.id ?? null;
  }

  private extractId(value: unknown): string | null {
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const id = (value as Record<string, unknown>).id;
    return typeof id === 'string' ? id : null;
  }

  private redact(body: unknown): unknown {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return body;
    }
    return Object.fromEntries(
      Object.entries(body as Record<string, unknown>).map(([key, value]) => [
        key,
        REDACTED_FIELDS.has(key) ? REDACTED_PLACEHOLDER : value,
      ]),
    );
  }
}
