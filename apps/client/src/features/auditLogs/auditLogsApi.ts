import { apiClient } from '@/lib/apiClient';

// Matches apps/api/src/auditLog/entities/auditLog.entity.ts. GET
// /audit-logs relations-loads actorUser (not just actorUserId), same
// treatment GET /message-logs gives `client`.
export interface AuditLog {
  id: string;
  actorUserId: string | null;
  actorUser: {
    id: string;
    fullName: string;
    email: string;
  } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  // Human-readable snapshot of the specific record — "Juana Pérez (CC
  // 1234567890)", "Pagaré #743" — resolved once at write time by the
  // backend's AuditLogInterceptor and frozen, not re-derived from the
  // live record on read. Null for an entityType with no labeling rule
  // yet, or an entity the backend couldn't resolve enough fields for.
  entityLabel: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogsQueryParams {
  actorUserId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedAuditLogs {
  items: AuditLog[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const auditLogsApi = {
  getAll: async (
    params: AuditLogsQueryParams = {},
  ): Promise<PaginatedAuditLogs> => {
    const { data, meta } = await apiClient.get<AuditLog[]>('/audit-logs', {
      actorUserId: params.actorUserId,
      action: params.action,
      entityType: params.entityType,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      page: params.page,
      limit: params.limit,
    });
    return { items: data, meta: meta as PaginatedAuditLogs['meta'] };
  },
};
