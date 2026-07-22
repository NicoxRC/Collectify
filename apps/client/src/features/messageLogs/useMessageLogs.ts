import { useQuery } from '@tanstack/react-query';

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
