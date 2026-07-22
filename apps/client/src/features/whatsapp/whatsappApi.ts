import { apiClient } from '@/lib/apiClient';

import type { MessageLog } from '@/features/messageLogs/messageLogsApi';

// Matches apps/api/src/whatsapp/whatsapp.controller.ts. GET /cron/status
// was added this phase (announced first) — pause/resume already existed
// with no way to read current state, which the pause/resume toggle needs
// to render correctly.
export const whatsappApi = {
  getCronStatus: async (): Promise<{ running: boolean }> => {
    const { data } = await apiClient.get<{ running: boolean }>(
      '/whatsapp/cron/status',
    );
    return data;
  },

  pauseCron: async (): Promise<void> => {
    await apiClient.post<{ paused: true }>('/whatsapp/cron/pause');
  },

  resumeCron: async (): Promise<void> => {
    await apiClient.post<{ paused: false }>('/whatsapp/cron/resume');
  },

  // Same grouping/rendering as the weekly job, triggered on demand for one
  // client. 400 if the client has no overdue installments.
  sendReminder: async (clientId: string): Promise<MessageLog> => {
    const { data } = await apiClient.post<MessageLog>(
      `/whatsapp/clients/${clientId}/send-reminder`,
    );
    return data;
  },
};
