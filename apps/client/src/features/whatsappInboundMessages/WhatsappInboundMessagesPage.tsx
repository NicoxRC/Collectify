import { useMemo, useState } from 'react';

import { Header } from '@/components/layout/Header';
import { useWhatsappInboundMessages } from '@/features/whatsappInboundMessages/useWhatsappInboundMessages';
import { useWhatsappInboundSocket } from '@/features/whatsappInboundMessages/useWhatsappInboundSocket';
import { WhatsappInboundMessageType } from '@/features/whatsappInboundMessages/whatsappInboundMessagesApi';
import { formatPhoneNumber } from '@/lib/format';

import type { WhatsappInboundMessage } from '@/features/whatsappInboundMessages/whatsappInboundMessagesApi';
import type { ReactNode } from 'react';

// No Figma frame for this phase (docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md /
// docs/phasesClient/PHASE_22_WHATSAPP_WEBHOOK.md). Redesigned from a flat
// table (one row per message) to a conversation inbox — one entry per
// contact, opened into a chat-style thread — matching how every real
// messaging inbox does this (WhatsApp itself, Intercom, Chatwoot, Front):
// nobody wants a table that grows one row per event from the same person.
// Updates live via useWhatsappInboundSocket instead of needing a manual
// refresh.
//
// Deliberately still read-only and still the "not blocked" floor: no
// reply box, no "claim conversation"/human-handoff UI, no button-flow
// auto-answers — those depend on the menu catalog and the still-open
// questions in docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md. This is
// groundwork (grouping + real-time) built ahead of that, at the human's
// explicit request.
const MESSAGE_FETCH_LIMIT = 100;

const TYPE_LABELS: Record<WhatsappInboundMessageType, string> = {
  [WhatsappInboundMessageType.Button]: 'Botón',
  [WhatsappInboundMessageType.Text]: 'Texto',
  [WhatsappInboundMessageType.Other]: 'Otro',
};

interface Conversation {
  key: string; // clientId when matched, otherwise the raw phone number
  displayName: string;
  phoneNumber: string;
  messages: WhatsappInboundMessage[]; // chronological — oldest first
  lastMessage: WhatsappInboundMessage;
}

// Groups the flat, newest-first message list into one conversation per
// contact. Purely client-side for now: with MESSAGE_FETCH_LIMIT covering
// every message received so far, a dedicated backend "conversations"
// aggregation endpoint isn't justified yet — revisit once volume actually
// requires server-side pagination per conversation, not per message.
function groupIntoConversations(
  messages: WhatsappInboundMessage[],
): Conversation[] {
  const byKey = new Map<string, WhatsappInboundMessage[]>();

  for (const message of messages) {
    const key = message.clientId ?? message.fromPhoneNumber;
    const existing = byKey.get(key);
    if (existing) {
      existing.push(message);
    } else {
      byKey.set(key, [message]);
    }
  }

  const conversations: Conversation[] = [];
  for (const [key, groupMessages] of byKey) {
    const lastMessage = groupMessages[0];
    conversations.push({
      key,
      displayName: lastMessage.client
        ? `${lastMessage.client.firstName} ${lastMessage.client.lastName}`
        : 'Número no reconocido',
      phoneNumber: lastMessage.fromPhoneNumber,
      messages: [...groupMessages].reverse(),
      lastMessage,
    });
  }

  return conversations.sort(
    (a, b) =>
      new Date(b.lastMessage.receivedAt).getTime() -
      new Date(a.lastMessage.receivedAt).getTime(),
  );
}

function formatSenderPhoneNumber(fromPhoneNumber: string): string {
  const withPlus = fromPhoneNumber.startsWith('+')
    ? fromPhoneNumber
    : `+${fromPhoneNumber}`;
  return formatPhoneNumber(withPlus);
}

function messagePreview(message: WhatsappInboundMessage): string {
  return (
    message.bodyText ??
    (message.buttonPayload ? `Botón: ${message.buttonPayload}` : '—')
  );
}

export function WhatsappInboundMessagesPage() {
  useWhatsappInboundSocket();

  const [search, setSearch] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data, isLoading, isError } = useWhatsappInboundMessages({
    search: search || undefined,
    limit: MESSAGE_FETCH_LIMIT,
  });

  const conversations = useMemo(
    () => groupIntoConversations(data?.items ?? []),
    [data],
  );

  const selectedConversation =
    conversations.find((conversation) => conversation.key === selectedKey) ??
    conversations[0] ??
    null;

  return (
    <div className="flex flex-col gap-5">
      <Header
        title="Mensajes entrantes"
        subtitle="Botones tocados y mensajes de texto que los clientes enviaron — se actualiza en vivo"
      />

      <div className="flex h-[38px] w-[280px] items-center gap-2 rounded bg-input px-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar cliente…"
          className="w-full bg-transparent text-small text-white placeholder-mid focus:outline-none"
        />
      </div>

      <div className="flex h-[70vh] overflow-hidden rounded bg-surface">
        <div className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-r border-border">
          {isLoading && <SidebarMessage>Cargando…</SidebarMessage>}
          {isError && (
            <SidebarMessage tone="error">
              No se pudieron cargar los mensajes entrantes.
            </SidebarMessage>
          )}
          {!isLoading && !isError && conversations.length === 0 && (
            <SidebarMessage>No hay mensajes entrantes todavía.</SidebarMessage>
          )}
          {conversations.map((conversation) => (
            <ConversationListItem
              key={conversation.key}
              conversation={conversation}
              isActive={conversation.key === selectedConversation?.key}
              onClick={() => setSelectedKey(conversation.key)}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {selectedConversation ? (
            <ConversationThread conversation={selectedConversation} />
          ) : (
            !isLoading && (
              <p className="text-small text-muted">
                Elegí una conversación para ver los mensajes.
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationListItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-1 border-b border-border px-4 py-3 text-left ${
        isActive ? 'bg-input' : 'hover:bg-input/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-small font-medium text-white">
          {conversation.displayName}
        </span>
        <span className="shrink-0 text-meta text-subtle">
          {new Date(conversation.lastMessage.receivedAt).toLocaleDateString(
            'es-CO',
            { day: '2-digit', month: '2-digit' },
          )}
        </span>
      </div>
      <span className="truncate text-meta text-muted">
        {messagePreview(conversation.lastMessage)}
      </span>
      {conversation.messages.length > 1 && (
        <span className="text-meta text-subtle">
          {conversation.messages.length} mensajes
        </span>
      )}
    </button>
  );
}

function ConversationThread({ conversation }: { conversation: Conversation }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border-b border-border pb-3">
        <p className="text-small font-medium text-white">
          {conversation.displayName}
        </p>
        <p className="text-meta text-muted">
          {formatSenderPhoneNumber(conversation.phoneNumber)}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {conversation.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: WhatsappInboundMessage }) {
  return (
    <div className="flex max-w-[480px] flex-col gap-1 rounded-lg bg-input px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="rounded-[3px] border border-border bg-surface px-1.5 py-0.5 text-meta text-muted">
          {TYPE_LABELS[message.type]}
        </span>
        <span className="text-meta text-subtle">
          {new Date(message.receivedAt).toLocaleString('es-CO', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      </div>
      <p className="text-small text-white">{messagePreview(message)}</p>
    </div>
  );
}

function SidebarMessage({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'error';
}) {
  return (
    <p
      className={`p-4 text-small ${tone === 'error' ? 'text-red-400' : 'text-muted'}`}
    >
      {children}
    </p>
  );
}
