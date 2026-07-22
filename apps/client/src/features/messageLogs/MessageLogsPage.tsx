import { useState } from 'react';

import { Header } from '@/components/layout/Header';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth/useAuth';
import { MessageLogDrawer } from '@/features/messageLogs/MessageLogDrawer';
import { MessageLogStatus } from '@/features/messageLogs/messageLogsApi';
import { useMessageLogs } from '@/features/messageLogs/useMessageLogs';
import {
  useCronStatus,
  usePauseCron,
  useResumeCron,
} from '@/features/whatsapp/useWhatsapp';
import { formatPhoneNumber } from '@/lib/format';

import type { MessageLog } from '@/features/messageLogs/messageLogsApi';
import type { ReactNode } from 'react';

// Matches Figma F-23 "Mensajes — Desktop 1440", scoped to type=overdue
// only (client's choice). Departures from the mockup — see
// apps/client/docs/DESIGN_TOKENS.md "Known design/backend gaps":
//   - Estado only has two real values (Enviado/Fallido) — no delivery/read
//     receipt tracking exists. The summary counts follow the same split
//     instead of Figma's four categories.
//   - "AD ADMIN" pill dropped — redundant with the sidebar footer.
//   - "Rango de fechas" is two date inputs (Desde/Hasta) instead of a
//     single dropdown — simpler than guessing what preset ranges the
//     dropdown was meant to offer, and maps directly to the API's
//     dateFrom/dateTo params.
//   - Added: an admin-only pause/resume control for the weekly cron — the
//     phase's own scope requires this, but no Figma frame shows where it
//     goes, so it lives here (the page about automatic sends).
type StatusFilter = 'all' | MessageLogStatus;

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: MessageLogStatus.Sent, label: 'Enviados' },
  { value: MessageLogStatus.Failed, label: 'Fallidos' },
];

export function MessageLogsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [openLog, setOpenLog] = useState<MessageLog | null>(null);

  const { data, isLoading, isError } = useMessageLogs({
    search: search || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    page,
  });
  const { data: sentCount } = useMessageLogs({
    status: MessageLogStatus.Sent,
    limit: 1,
  });
  const { data: failedCount } = useMessageLogs({
    status: MessageLogStatus.Failed,
    limit: 1,
  });

  const { data: cronStatus } = useCronStatus();
  const pauseCron = usePauseCron();
  const resumeCron = useResumeCron();

  const logs = data?.items ?? [];
  const meta = data?.meta;
  const rowNumberOffset = ((meta?.page ?? 1) - 1) * (meta?.limit ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Header
          title="Historial de mensajes"
          subtitle="Todos los mensajes enviados vía WhatsApp"
        />
        {isAdmin && cronStatus && (
          <div className="flex items-center gap-3.5 rounded border border-border bg-surface px-5 py-3.5">
            <span
              className={`size-2 shrink-0 rounded-full ${cronStatus.running ? 'bg-[#22c55e]' : 'bg-[#eab308]'}`}
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-small font-medium text-white">
                Envío automático — {cronStatus.running ? 'Activo' : 'Pausado'}
              </span>
              <span className="text-meta text-muted">
                Recordatorio de mora · Lun, mié y vie, 9:00 a.m.
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                cronStatus.running ? pauseCron.mutate() : resumeCron.mutate()
              }
              disabled={pauseCron.isPending || resumeCron.isPending}
              className="ml-2 rounded border border-border bg-input px-4 py-2 text-small text-muted hover:text-white disabled:opacity-50"
            >
              {cronStatus.running ? 'Pausar' : 'Reanudar'}
            </button>
          </div>
        )}
      </div>

      <div className="flex h-10 items-center gap-3">
        <DatePicker
          value={dateFrom}
          onChange={(next) => {
            setDateFrom(next);
            setPage(1);
          }}
          ariaLabel="Desde"
          className="h-[38px] w-[150px] rounded bg-input px-3 text-small text-muted"
        />
        <DatePicker
          value={dateTo}
          onChange={(next) => {
            setDateTo(next);
            setPage(1);
          }}
          ariaLabel="Hasta"
          className="h-[38px] w-[150px] rounded bg-input px-3 text-small text-muted"
        />

        <Select
          value={statusFilter}
          onChange={(next) => {
            setStatusFilter(next as StatusFilter);
            setPage(1);
          }}
          options={STATUS_FILTER_OPTIONS}
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

        <div className="flex-1" />

        <div className="flex items-center gap-3 text-label text-muted">
          <Legend
            color="#22c55e"
            label={`${sentCount?.meta.total ?? 0} Enviados`}
          />
          <Legend
            color="#ef4444"
            label={`${failedCount?.meta.total ?? 0} Fallidos`}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded bg-surface">
        <table className="w-full">
          <thead className="bg-input">
            <tr>
              <Th>Cliente</Th>
              <Th>Celular</Th>
              <Th>Fecha envío</Th>
              <Th>Estado</Th>
              <Th>Preview del mensaje</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <EmptyRow>Cargando…</EmptyRow>}
            {isError && (
              <EmptyRow tone="error">
                No se pudo cargar el historial de mensajes.
              </EmptyRow>
            )}
            {!isLoading && !isError && logs.length === 0 && (
              <EmptyRow>No se encontraron mensajes.</EmptyRow>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-border">
                <Td>
                  {log.client.firstName} {log.client.lastName}
                </Td>
                <Td className="text-muted">
                  {formatPhoneNumber(log.phoneNumber)}
                </Td>
                <Td className="text-muted">
                  {new Date(log.sentAt).toLocaleString('es-CO', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </Td>
                <Td>
                  <span
                    className={`rounded-[3px] border px-2 py-[3px] text-meta font-medium ${
                      log.status === MessageLogStatus.Sent
                        ? 'border-[#22c55e] bg-[#051e0e] text-[#22c55e]'
                        : 'border-[#ef4444] bg-[#240a0a] text-[#ef4444]'
                    }`}
                  >
                    {log.status === MessageLogStatus.Sent
                      ? 'Enviado'
                      : 'Fallido'}
                  </span>
                </Td>
                <Td className="max-w-[280px] truncate text-muted">
                  {log.messageContent}
                </Td>
                <Td>
                  <button
                    type="button"
                    onClick={() => setOpenLog(log)}
                    className="rounded-[3px] border border-border bg-input px-1.75 py-1 text-meta text-muted hover:text-white"
                  >
                    Ver completo
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total > 0 && (
        <div className="flex h-8 items-center justify-between">
          <p className="text-label text-muted">
            Mostrando {rowNumberOffset + logs.length} de {meta.total} mensajes
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

      {openLog && (
        <MessageLogDrawer log={openLog} onClose={() => setOpenLog(null)} />
      )}
    </div>
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
        colSpan={6}
        className={`p-6 text-center text-small ${tone === 'error' ? 'text-red-400' : 'text-muted'}`}
      >
        {children}
      </td>
    </tr>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{label}</span>
    </span>
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
