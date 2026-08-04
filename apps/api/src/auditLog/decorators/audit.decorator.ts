import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditMetadata {
  action: string;
  entityType: string;
}

// Marks a mutating endpoint for the globally-registered AuditLogInterceptor
// to record. `action` follows the '<entityType>.<verb>' convention, e.g.
// 'client.create', 'loan.refinance', 'payment.register', 'user.deactivate'
// — see docs/phases/PHASE_11_AUDIT_LOG.md. Endpoints without this decorator
// are silently skipped by the interceptor: read-only routes, auth, health
// checks, etc. don't need an audit trail entry.
export const Audit = (action: string, entityType: string) =>
  SetMetadata(AUDIT_KEY, { action, entityType } satisfies AuditMetadata);
