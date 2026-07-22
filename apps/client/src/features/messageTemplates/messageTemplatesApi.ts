import { apiClient } from '@/lib/apiClient';

// Matches apps/api/src/whatsapp/messageType.enum.ts exactly. The backend
// already supports all four (new_loan, upcoming_due, overdue,
// account_summary — built ahead of the Fase 9 client scope), but this
// phase's UI only surfaces `overdue`, per the client's explicit choice to
// keep Fase 5 scoped to the original plan rather than build all four now.
// See apps/client/docs/DESIGN_TOKENS.md "Known design/backend gaps".
export enum MessageType {
  NewLoan = 'new_loan',
  UpcomingDue = 'upcoming_due',
  Overdue = 'overdue',
  AccountSummary = 'account_summary',
}

export interface MessageTemplate {
  id: string;
  name: string;
  type: MessageType;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateMessageTemplateInput {
  name: string;
  type: MessageType;
  content: string;
}

export interface UpdateMessageTemplateInput {
  name?: string;
  content?: string;
}

export const messageTemplatesApi = {
  // GET /message-templates returns every template regardless of type — the
  // Overdue-only filter is applied client-side (useMessageTemplates), since
  // the API has no type query param.
  getAll: async (): Promise<MessageTemplate[]> => {
    const { data } =
      await apiClient.get<MessageTemplate[]>('/message-templates');
    return data;
  },

  create: async (
    input: CreateMessageTemplateInput,
  ): Promise<MessageTemplate> => {
    const { data } = await apiClient.post<MessageTemplate>(
      '/message-templates',
      input,
    );
    return data;
  },

  update: async (
    id: string,
    input: UpdateMessageTemplateInput,
  ): Promise<MessageTemplate> => {
    const { data } = await apiClient.patch<MessageTemplate>(
      `/message-templates/${id}`,
      input,
    );
    return data;
  },

  activate: async (id: string): Promise<MessageTemplate> => {
    const { data } = await apiClient.post<MessageTemplate>(
      `/message-templates/${id}/activate`,
    );
    return data;
  },

  // 204 No Content — added this phase (announced first): the delete button
  // in the Editar plantilla modal had no backing endpoint before. Rejects
  // (400) if the template is currently active.
  remove: async (id: string): Promise<void> => {
    await apiClient.delete<void>(`/message-templates/${id}`);
  },
};
