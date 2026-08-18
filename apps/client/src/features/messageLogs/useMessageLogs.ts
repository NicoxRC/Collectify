import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { messageLogsApi } from '@/features/messageLogs/messageLogsApi';

import type { MessageLogsQueryParams } from '@/features/messageLogs/messageLogsApi';

export function useMessageLogs(params: MessageLogsQueryParams) {
  return useQuery({
    queryKey: ['messageLogs', params],
    queryFn: () => messageLogsApi.getAll(params),
  });
}

export function useMessageLogItems(id: string | null) {
  return useQuery({
    queryKey: ['messageLogs', id, 'items'],
    queryFn: () => messageLogsApi.getItems(id ?? ''),
    enabled: Boolean(id),
  });
}

// Phase 18 — retrying creates a new MessageLog row and stamps retriedAt on
// the original, so the whole list needs refetching either way.
export function useRetryMessageLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: messageLogsApi.retry,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['messageLogs'] }),
  });
}
