import { useState } from 'react';

import { Header } from '@/components/layout/Header';
import { Select } from '@/components/ui/Select';
import { useWhatsappInboundMessages } from '@/features/whatsappInboundMessages/useWhatsappInboundMessages';
import { WhatsappInboundMessageType } from '@/features/whatsappInboundMessages/whatsappInboundMessagesApi';
import { formatPhoneNumber } from '@/lib/format';

import type { WhatsappInboundMessage } from '@/features/whatsappInboundMessages/whatsappInboundMessagesApi';
import type { ReactNode } from 'react';

// No Figma frame for this phase (docs/phases/PHASE_22_WHATSAPP_WEBHOOK.md /
// docs/phasesClient/PHASE_22_WHATSAPP_WEBHOOK.md) — built reusing
// AuditLogsPage.tsx's exact skeleton (filters row, paginated table, no
// per-row detail drawer needed here since a message's full content already
// fits in one column). Admin-only, same treatment as Auditoría/Tasa de
// usura/Usuarios.
//
// Deliberately read-only: this is the "not blocked" floor from the phase
// doc. No button-flow/"menu" management UI, no preference/opt-out UI, no
// automated-reply UI — all of that is blocked on open questions the human
// asked to leave open. A button tap shows up here exactly like free text,
// with no indication anything was (or should have been) triggered by it.
type TypeFilter = 'all' | WhatsappInboundMessageType;

const TYPE_LABELS: Record<WhatsappInboundMessageType, string> = {
  [WhatsappInboundMessageType.Button]: 'Botón',
  [WhatsappInboundMessageType.Text]: 'Texto',
  [WhatsappInboundMessageType.Other]: 'Otro',
};

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  ...Object.values(WhatsappInboundMessageType).map((type) => ({
    value: type,
    label: TYPE_LABELS[type],
  })),
];

// Meta sends the sender's number without a leading "+" (see
// apps/api/src/whatsapp/webhook/normalizeIncomingPhoneNumber.ts);
// formatPhoneNumber expects the E.164 "+57..." shape, so this mirrors that
// same normalization for display only.
function formatSenderPhoneNumber(fromPhoneNumber: string): string {
  const withPlus = fromPhoneNumber.startsWith('+')
    ? fromPhoneNumber
    : `+${fromPhoneNumber}`;
  return formatPhoneNumber(withPlus);
}

export function WhatsappInboundMessagesPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useWhatsappInboundMessages({
    search: search || undefined,
    type: typeFilter === 'all' ? undefined : typeFilter,
    page,
  });

  const messages = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-5">
      <Header
        title="Mensajes entrantes"
        subtitle="Botones tocados y mensajes de texto que los clientes enviaron"
      />

      <div className="flex h-10 items-center gap-3">
        <Select
          value={typeFilter}
          onChange={(next) => {
            setTypeFilter(next as TypeFilter);
            setPage(1);
          }}
          options={TYPE_FILTER_OPTIONS}
          className="w-[190px]"
        />

        <div className="flex h-[38px] w-[220px] items-center gap-2 rounded bg-input px-3">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar cliente…"
            className="w-full bg-transparent text-small text-white placeholder-mid focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded bg-surface">
        <table className="w-full">
          <thead className="bg-input">
            <tr>
              <Th>Remitente</Th>
              <Th>Cliente</Th>
              <Th>Tipo</Th>
              <Th>Contenido</Th>
              <Th>Fecha recibido</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <EmptyRow>Cargando…</EmptyRow>}
            {isError && (
              <EmptyRow tone="error">
                No se pudieron cargar los mensajes entrantes.
              </EmptyRow>
            )}
            {!isLoading && !isError && messages.length === 0 && (
              <EmptyRow>No hay mensajes entrantes todavía.</EmptyRow>
            )}
            {messages.map((message) => (
              <MessageRow key={message.id} message={message} />
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total > 0 && (
        <div className="flex h-8 items-center justify-between">
          <p className="text-label text-muted">
            Mostrando {messages.length} de {meta.total} mensajes
          </p>
          <div className="flex items-center gap-1">
            <PageButton
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              ←
            </PageButton>
            {Array.from(
              { length: meta.totalPages },
              (_, index) => index + 1,
            ).map((pageNumber) => (
              <PageButton
                key={pageNumber}
                isActive={pageNumber === page}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </PageButton>
            ))}
            <PageButton
              disabled={page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              →
            </PageButton>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageRow({ message }: { message: WhatsappInboundMessage }) {
  const content =
    message.bodyText ??
    (message.buttonPayload ? `Botón: ${message.buttonPayload}` : '—');

  return (
    <tr className="border-t border-border">
      <Td className="text-muted">
        {formatSenderPhoneNumber(message.fromPhoneNumber)}
      </Td>
      <Td>
        {message.client
          ? `${message.client.firstName} ${message.client.lastName}`
          : 'Número no reconocido'}
      </Td>
      <Td className="text-muted">{TYPE_LABELS[message.type]}</Td>
      <Td className="max-w-[320px] truncate text-muted">{content}</Td>
      <Td className="text-muted">
        {new Date(message.receivedAt).toLocaleString('es-CO', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}
      </Td>
    </tr>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="h-[38px] px-3.5 text-left text-label font-medium tracking-[0.36px] text-muted">
      {children}
    </th>
  );
}

function Td({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`h-11 px-3.5 text-small font-medium text-white ${className}`}
    >
      {children}
    </td>
  );
}

function EmptyRow({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'error';
}) {
  return (
    <tr>
      <td
        colSpan={5}
        className={`p-6 text-center text-small ${tone === 'error' ? 'text-red-400' : 'text-muted'}`}
      >
        {children}
      </td>
    </tr>
  );
}

function PageButton({
  children,
  onClick,
  isActive = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-2.5 py-1.5 text-label ${
        isActive
          ? 'bg-border font-medium text-white'
          : 'bg-input text-muted disabled:opacity-40'
      }`}
    >
      {children}
    </button>
  );
}
