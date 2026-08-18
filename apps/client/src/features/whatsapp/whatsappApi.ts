import { apiClient } from '@/lib/apiClient';

import type { MessageLog } from '@/features/messageLogs/messageLogsApi';
import type {
  MessageTemplate,
  MessageType,
} from '@/features/messageTemplates/messageTemplatesApi';

// Matches apps/api/src/whatsapp/whatsapp.controller.ts. Phase 18 replaced
// the old hardcoded per-type routes (/cron/status, /cron/upcoming-due/
// status, ...) with one parametrized set — all 4 message types now have a
// cron job, not just overdue/upcoming-due. See
// docs/phases/PHASE_18_MESSAGE_AUDIENCES.md.
export const whatsappApi = {
  getCronStatus: async (type: MessageType): Promise<{ running: boolean }> => {
    const { data } = await apiClient.get<{ running: boolean }>(
      `/whatsapp/cron/${type}/status`,
    );
    return data;
  },

  pauseCron: async (type: MessageType): Promise<void> => {
    await apiClient.post<{ paused: true }>(`/whatsapp/cron/${type}/pause`);
  },

  resumeCron: async (type: MessageType): Promise<void> => {
    await apiClient.post<{ paused: false }>(`/whatsapp/cron/${type}/resume`);
  },

  // Persists on MessageTemplate.cronExpression and reschedules the running
  // job immediately, no restart needed.
  updateCronSchedule: async (
    type: MessageType,
    cronExpression: string,
  ): Promise<MessageTemplate> => {
    const { data } = await apiClient.patch<MessageTemplate>(
      `/whatsapp/cron/${type}/schedule`,
      { cronExpression },
    );
    return data;
  },

  // Same grouping/rendering as the weekly job, triggered on demand for one
  // client. 400 if the client has no overdue installments.
  sendReminder: async (clientId: string): Promise<MessageLog> => {
    const { data } = await apiClient.post<MessageLog>(
      `/whatsapp/clients/${clientId}/send-reminder`,
    );
    return data;
  },

  // 400 if the client has no installments approaching due date across
  // their active loans.
  sendUpcomingDueReminder: async (clientId: string): Promise<MessageLog> => {
    const { data } = await apiClient.post<MessageLog>(
      `/whatsapp/clients/${clientId}/send-upcoming-due`,
    );
    return data;
  },

  // On-demand only — separate from the audience-only cron. 400 if the
  // client has no pending installments across their active loans.
  sendAccountSummary: async (clientId: string): Promise<MessageLog> => {
    const { data } = await apiClient.post<MessageLog>(
      `/whatsapp/clients/${clientId}/send-account-summary`,
    );
    return data;
  },
};
