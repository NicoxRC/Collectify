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
