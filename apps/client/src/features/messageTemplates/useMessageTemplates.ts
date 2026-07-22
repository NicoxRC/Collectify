import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  MessageType,
  messageTemplatesApi,
} from '@/features/messageTemplates/messageTemplatesApi';

import type {
  CreateMessageTemplateInput,
  UpdateMessageTemplateInput,
} from '@/features/messageTemplates/messageTemplatesApi';

// Filters to Overdue client-side — see messageTemplatesApi.ts's note on
// why the API itself isn't filtered (no type query param, and the other
// three types are real but out of this phase's scope).
export function useMessageTemplates() {
  return useQuery({
    queryKey: ['messageTemplates'],
    queryFn: messageTemplatesApi.getAll,
    select: (templates) =>
      templates.filter((template) => template.type === MessageType.Overdue),
  });
}

export function useCreateMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateMessageTemplateInput, 'type'>) =>
      messageTemplatesApi.create({ ...input, type: MessageType.Overdue }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['messageTemplates'] }),
  });
}

export function useUpdateMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateMessageTemplateInput;
    }) => messageTemplatesApi.update(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['messageTemplates'] }),
  });
}

export function useActivateMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: messageTemplatesApi.activate,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['messageTemplates'] }),
  });
}

export function useDeleteMessageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: messageTemplatesApi.remove,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['messageTemplates'] }),
  });
}
