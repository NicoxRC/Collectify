// Human-readable Spanish translations for AuditLog.action/entityType — both
// are free text server-side (set by whichever endpoint's @Audit() decorator
// fired, see apps/api/src/auditLog/auditLog.interceptor.ts), not real
// enums, so admins were seeing raw values like "client.create" and
// "client" · <uuid> in the Auditoría screen with no way to tell what
// actually happened. Shared between AuditLogsPage.tsx's table and
// AuditLogDrawer.tsx's detail view so both stay in sync.
//
// Extend this list whenever a new @Audit('x.y', 'z') call is added to the
// backend (grep `@Audit(` under apps/api/src) — an action/entityType
// missing here just falls back to showing the raw value instead of
// breaking, so nothing needs to ship in lockstep.
export const ACTION_LABELS: Record<string, string> = {
  'client.create': 'Creó un cliente',
  'client.update': 'Editó un cliente',
  'client.deactivate': 'Desactivó un cliente',
  'client.reactivate': 'Reactivó un cliente',
  'client.addReference': 'Agregó una referencia',
  'client.updateReference': 'Editó una referencia',
  'client.removeReference': 'Eliminó una referencia',
  'loan.create': 'Creó un préstamo',
  'loan.update': 'Editó un préstamo',
  'loan.payoff': 'Liquidó un préstamo',
  'loan.refinance': 'Refinanció un préstamo',
  'payment.register': 'Registró un pago',
  'user.create': 'Creó un usuario',
  'user.deactivate': 'Desactivó un usuario',
  'user.reactivate': 'Reactivó un usuario',
  'usuryRate.create': 'Creó una tasa de usura',
};

// Mirrors the entityType values @Audit()-decorated endpoints actually use
// today. AuditLogsPage's filter dropdown intentionally doesn't offer every
// one of these (e.g. "usuryRate" has no filter option — see
// ENTITY_TYPE_FILTER_OPTIONS there), but every value that CAN show up in a
// row still needs a display label here.
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  client: 'Cliente',
  loan: 'Préstamo',
  payment: 'Pago',
  user: 'Usuario',
  usuryRate: 'Tasa de usura',
};

export function formatAuditAction(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function formatAuditEntityType(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType] ?? entityType;
}
