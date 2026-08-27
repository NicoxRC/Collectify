import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { connectNamespace } from '@/lib/socket';

// Pushes a live update into the "Mensajes entrantes" inbox — see
// docs/phasesClient/PHASE_22_WHATSAPP_WEBHOOK.md. Invalidates rather than
// merging the pushed message directly into the cache, matching this
// project's existing pattern (useRetryMessageLog) for "something changed,
// refetch" instead of hand-rolled cache surgery.
export function useWhatsappInboundSocket(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = connectNamespace('whatsapp-inbound');

    socket.on('inbound-message', () => {
      void queryClient.invalidateQueries({
        queryKey: ['whatsappInboundMessages'],
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);
}
