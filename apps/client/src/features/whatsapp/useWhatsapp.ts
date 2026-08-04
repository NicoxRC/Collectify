import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { whatsappApi } from '@/features/whatsapp/whatsappApi';

export function useCronStatus() {
  return useQuery({
    queryKey: ['whatsapp', 'cronStatus'],
    queryFn: whatsappApi.getCronStatus,
  });
}

export function usePauseCron() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: whatsappApi.pauseCron,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'cronStatus'] }),
  });
}

export function useResumeCron() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: whatsappApi.resumeCron,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['whatsapp', 'cronStatus'] }),
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

// Fase 9 — Aviso (upcoming-due reminder). Mirrors the overdue reminder's
// hooks above exactly.
export function useUpcomingDueCronStatus() {
  return useQuery({
    queryKey: ['whatsapp', 'upcomingDueCronStatus'],
    queryFn: whatsappApi.getUpcomingDueCronStatus,
  });
}

export function usePauseUpcomingDueCron() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: whatsappApi.pauseUpcomingDueCron,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['whatsapp', 'upcomingDueCronStatus'],
      }),
  });
}

export function useResumeUpcomingDueCron() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: whatsappApi.resumeUpcomingDueCron,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['whatsapp', 'upcomingDueCronStatus'],
      }),
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

// Fase 9 — Estado de cuenta. On-demand only, no cron.
export function useSendAccountSummary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: whatsappApi.sendAccountSummary,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['messageLogs'] }),
  });
}
