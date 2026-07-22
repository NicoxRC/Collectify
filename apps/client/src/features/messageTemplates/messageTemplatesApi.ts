import { apiClient } from '@/lib/apiClient';

// Matches apps/api/src/whatsapp/messageType.enum.ts exactly.
export enum MessageType {
  NewLoan = 'new_loan',
  UpcomingDue = 'upcoming_due',
  Overdue = 'overdue',
  AccountSummary = 'account_summary',
}

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
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export const messageTemplatesApi = {
  // GET /message-templates is the only endpoint left — read-only, one row
  // per MessageType. Admin-only server-side (whole controller).
  getAll: async (): Promise<MessageTemplate[]> => {
    const { data } =
      await apiClient.get<MessageTemplate[]>('/message-templates');
    return data;
  },
};
