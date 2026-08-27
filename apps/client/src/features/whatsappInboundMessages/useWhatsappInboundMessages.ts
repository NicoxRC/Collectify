import { useQuery } from '@tanstack/react-query';

import { whatsappInboundMessagesApi } from '@/features/whatsappInboundMessages/whatsappInboundMessagesApi';

import type { WhatsappInboundMessagesQueryParams } from '@/features/whatsappInboundMessages/whatsappInboundMessagesApi';

export function useWhatsappInboundMessages(
  params: WhatsappInboundMessagesQueryParams,
) {
  return useQuery({
    queryKey: ['whatsappInboundMessages', params],
    queryFn: () => whatsappInboundMessagesApi.getAll(params),
  });
}
