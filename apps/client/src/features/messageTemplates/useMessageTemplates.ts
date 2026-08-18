import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  MESSAGE_TYPE_ORDER,
  messageTemplatesApi,
} from '@/features/messageTemplates/messageTemplatesApi';

import type { MessageType } from '@/features/messageTemplates/messageTemplatesApi';

// Fase 9: all four types are now shown (previously filtered to `overdue`
// only — that scoping made sense before the backend made templates
// read-only, since editing a global content field only had one flow
// wired up; now that this is just a read-only viewer, there's no reason
// to hide the other three). Sorted into a fixed, meaningful order
// (MESSAGE_TYPE_ORDER) instead of whatever order the API happens to
// return, since the four don't have a natural alphabetical/chronological
// order.
export function useMessageTemplates() {
  return useQuery({
    queryKey: ['messageTemplates'],
    queryFn: messageTemplatesApi.getAll,
    select: (templates) =>
      [...templates].sort(
        (a, b) =>
          MESSAGE_TYPE_ORDER.indexOf(a.type) -
          MESSAGE_TYPE_ORDER.indexOf(b.type),
      ),
  });
}

// Phase 18 — the curated audience attached to one template. null means
// none has been set yet (PUT creates it on first save).
export function useMessageAudience(type: MessageType) {
  return useQuery({
    queryKey: ['messageTemplates', type, 'audience'],
    queryFn: () => messageTemplatesApi.getAudience(type),
  });
}

export function useUpdateMessageAudience(type: MessageType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientIds: string[]) =>
      messageTemplatesApi.updateAudience(type, clientIds),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['messageTemplates', type, 'audience'],
      }),
  });
}
