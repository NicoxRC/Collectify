import { apiClient } from '@/lib/apiClient';

import type { Client } from '@/features/clients/clientsApi';

// Matches apps/api/src/whatsapp/messageType.enum.ts exactly.
export enum MessageType {
  NewLoan = 'new_loan',
  UpcomingDue = 'upcoming_due',
  Overdue = 'overdue',
  AccountSummary = 'account_summary',
}

// Display order + Spanish labels for the four message types — shared
// across this page, MessageLogsPage, and ClientDetailPage/LoanDetailPage
// (Fase 9) so the wording is consistent everywhere a type shows up.
// Matches the terms in docs/GLOSSARY.md exactly: "Mensaje de primera vez",
// "Aviso", "Recordatorio de mora", "Estado de cuenta".
export const MESSAGE_TYPE_ORDER: MessageType[] = [
  MessageType.NewLoan,
  MessageType.UpcomingDue,
  MessageType.Overdue,
  MessageType.AccountSummary,
];

export const MESSAGE_TYPE_LABELS: Record<MessageType, string> = {
  [MessageType.NewLoan]: 'Primera vez',
  [MessageType.UpcomingDue]: 'Aviso',
  [MessageType.Overdue]: 'Recordatorio de mora',
  [MessageType.AccountSummary]: 'Estado de cuenta',
};

// Post-refactor (main, PR #16 on the backend side): templates are no
// longer admin-editable. WhatsApp only allows a business to *initiate* a
// conversation through a Meta-approved template, so a freely-editable
// `content` column never reflected reality — changing it here wouldn't
// change what Meta actually sends. `isActive` and the create/update/
// activate/delete endpoints were removed; `type` is now UNIQUE (exactly
// one row per type). See docs/DATABASE.md "Changed after Phase 9" and
// apps/client/docs/DESIGN_TOKENS.md "Known design/backend gaps".
export interface MessageTemplate {
  id: string;
  name: string;
  type: MessageType;
  content: string;
  // Phase 18 — admin-editable cron schedule. Null falls back to a
  // per-type code default on the server (see WhatsappCronService).
  cronExpression: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// Phase 18 — the curated group of clients attached to a template. Additive
// on top of whatever dynamically qualifies for overdue/upcoming_due/
// new_loan; the entire recipient list for account_summary, which has no
// dynamic condition. One audience per template — confirmed with the human,
// even though the api's schema doesn't hard-restrict multiplicity.
export interface MessageAudience {
  id: string;
  messageTemplateId: string;
  name: string;
  clients: Client[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export const messageTemplatesApi = {
  // GET /message-templates is the only read endpoint left on the template
  // itself — read-only, one row per MessageType. Admin-only server-side
  // (whole controller).
  getAll: async (): Promise<MessageTemplate[]> => {
    const { data } =
      await apiClient.get<MessageTemplate[]>('/message-templates');
    return data;
  },

  // Returns null when no audience has been set for this type yet.
  getAudience: async (type: MessageType): Promise<MessageAudience | null> => {
    const { data } = await apiClient.get<MessageAudience | null>(
      `/message-templates/${type}/audience`,
    );
    return data;
  },

  // Replaces the full client list — not incremental add/remove.
  updateAudience: async (
    type: MessageType,
    clientIds: string[],
  ): Promise<MessageAudience> => {
    const { data } = await apiClient.put<MessageAudience>(
      `/message-templates/${type}/audience`,
      { clientIds },
    );
    return data;
  },
};
