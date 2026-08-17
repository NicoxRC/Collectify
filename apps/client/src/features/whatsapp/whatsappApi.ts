import { apiClient } from '@/lib/apiClient';

import type { MessageLog } from '@/features/messageLogs/messageLogsApi';

// Matches apps/api/src/whatsapp/whatsapp.controller.ts. GET /cron/status
// was added in Fase 5 (announced first) — pause/resume already existed
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

  // Fase 9 — Aviso (upcoming-due reminder). GET /cron/upcoming-due/status
  // was added this phase (announced first, mirrors GET /cron/status —
  // the original endpoint only ever read the overdue cron's job by name).
  getUpcomingDueCronStatus: async (): Promise<{ running: boolean }> => {
    const { data } = await apiClient.get<{ running: boolean }>(
      '/whatsapp/cron/upcoming-due/status',
    );
    return data;
  },

  pauseUpcomingDueCron: async (): Promise<void> => {
    await apiClient.post<{ paused: true }>('/whatsapp/cron/upcoming-due/pause');
  },

  resumeUpcomingDueCron: async (): Promise<void> => {
    await apiClient.post<{ paused: false }>(
      '/whatsapp/cron/upcoming-due/resume',
    );
  },

  // 400 if the client has no installments approaching due date across
  // their active loans.
  sendUpcomingDueReminder: async (clientId: string): Promise<MessageLog> => {
    const { data } = await apiClient.post<MessageLog>(
      `/whatsapp/clients/${clientId}/send-upcoming-due`,
    );
    return data;
  },

  // Fase 9 — Estado de cuenta. On-demand only, no cron/pause-resume. 400
  // if the client has no pending installments across their active loans.
  sendAccountSummary: async (clientId: string): Promise<MessageLog> => {
    const { data } = await apiClient.post<MessageLog>(
      `/whatsapp/clients/${clientId}/send-account-summary`,
    );
    return data;
  },
};
