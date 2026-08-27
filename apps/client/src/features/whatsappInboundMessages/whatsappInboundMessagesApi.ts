import { apiClient } from '@/lib/apiClient';

// Matches apps/api/src/whatsapp/entities/whatsappInboundMessage.entity.ts's
// WhatsappInboundMessageType.
export enum WhatsappInboundMessageType {
  Button = 'button',
  Text = 'text',
  Other = 'other',
}

// GET /whatsapp/inbound-messages leftJoinAndSelects `client` so the list
// can show a name (or "número no reconocido") instead of a bare id — same
// shape as MessageLog.client, nullable here since an inbound message from
// an unrecognized number is still logged, not dropped. See
// docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md.
export interface WhatsappInboundMessage {
  id: string;
  clientId: string | null;
  client: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  fromPhoneNumber: string;
  type: WhatsappInboundMessageType;
  buttonPayload: string | null;
  bodyText: string | null;
  receivedAt: string;
  createdAt: string;
}

export interface WhatsappInboundMessagesQueryParams {
  clientId?: string;
  type?: WhatsappInboundMessageType;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedWhatsappInboundMessages {
  items: WhatsappInboundMessage[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const whatsappInboundMessagesApi = {
  getAll: async (
    params: WhatsappInboundMessagesQueryParams = {},
  ): Promise<PaginatedWhatsappInboundMessages> => {
    const { data, meta } = await apiClient.get<WhatsappInboundMessage[]>(
      '/whatsapp/inbound-messages',
      {
        clientId: params.clientId,
        type: params.type,
        search: params.search,
        page: params.page,
        limit: params.limit,
      },
    );
    return {
      items: data,
      meta: meta as PaginatedWhatsappInboundMessages['meta'],
    };
  },

  // Manual reply — free-form session message, only meaningful once the
  // client has messaged in and opened the 24h window. See
  // WhatsappInboundMessagesPage.tsx's TEST_MENU_HUMAN_OPTION.
  reply: async (phoneNumber: string, message: string): Promise<boolean> => {
    const { data } = await apiClient.post<{ sent: boolean }>(
      '/whatsapp/inbound-messages/reply',
      { phoneNumber, message },
    );
    return data.sent;
  },
};
