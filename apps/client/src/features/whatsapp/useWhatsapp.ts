import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { whatsappApi } from '@/features/whatsapp/whatsappApi';

import type { MessageType } from '@/features/messageTemplates/messageTemplatesApi';

// Phase 18 — parametrized by type since all 4 message types now have a
// cron job, sharing one status/pause/resume/reschedule contract. Replaces
// the old one-off overdue/upcoming-due-specific hooks.
export function useCronStatus(type: MessageType) {
  return useQuery({
    queryKey: ['whatsapp', 'cronStatus', type],
    queryFn: () => whatsappApi.getCronStatus(type),
  });
}

export function usePauseCron(type: MessageType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => whatsappApi.pauseCron(type),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['whatsapp', 'cronStatus', type],
      }),
  });
}

export function useResumeCron(type: MessageType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => whatsappApi.resumeCron(type),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['whatsapp', 'cronStatus', type],
      }),
  });
}

export function useUpdateCronSchedule(type: MessageType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cronExpression: string) =>
      whatsappApi.updateCronSchedule(type, cronExpression),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['whatsapp', 'cronStatus', type],
        }),
        queryClient.invalidateQueries({ queryKey: ['messageTemplates'] }),
      ]),
  });
}

// Invalidates messageLogs (and, via clientId, the client's own history)
// since a successful manual send creates a new MessageLog row.
export function useSendReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: whatsappApi.sendReminder,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['messageLogs'] }),
  });
}

export function useSendUpcomingDueReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: whatsappApi.sendUpcomingDueReminder,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['messageLogs'] }),
  });
}

export function useSendAccountSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: whatsappApi.sendAccountSummary,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['messageLogs'] }),
  });
}
