import { useState } from 'react';

import { Header } from '@/components/layout/Header';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth/useAuth';
import { MessageLogDrawer } from '@/features/messageLogs/MessageLogDrawer';
import { MessageLogStatus } from '@/features/messageLogs/messageLogsApi';
import { useMessageLogs } from '@/features/messageLogs/useMessageLogs';
import {
  MESSAGE_TYPE_LABELS,
  MESSAGE_TYPE_ORDER,
} from '@/features/messageTemplates/messageTemplatesApi';
import {
  useCronStatus,
  usePauseCron,
  usePauseUpcomingDueCron,
  useResumeCron,
  useResumeUpcomingDueCron,
  useUpcomingDueCronStatus,
} from '@/features/whatsapp/useWhatsapp';
import { formatPhoneNumber } from '@/lib/format';

import type { MessageLog } from '@/features/messageLogs/messageLogsApi';
import type { MessageType } from '@/features/messageTemplates/messageTemplatesApi';
import type { ReactNode } from 'react';

// Matches Figma F-23 "Mensajes — Desktop 1440". Originally scoped to
// type=overdue only (client's choice, Fase 5); Fase 9 lifted that scoping
// now that three more message types exist — see the "Tipo" column/filter
// below. Other departures from the mockup — see
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
//   - Changed after go-live (confirmed with the client's colleague): this
//     page used to have a Todos/Enviados/Fallidos filter defaulting to
//     "Todos". It now always shows only failed/unsent messages — the
//     table is meant to be a to-do list of sends that need attention, not
//     a full audit log. The Enviados/Fallidos legend counts are kept as
//     read-only context (they still reflect the true totals, not just
//     what's listed).
type TypeFilter = 'all' | MessageType;

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos los tipos' },
  ...MESSAGE_TYPE_ORDER.map((type) => ({
    value: type,
    label: MESSAGE_TYPE_LABELS[type],
  })),
];

export function MessageLogsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [openLog, setOpenLog] = useState<MessageLog | null>(null);

  // Always scoped to failed/unsent messages — see the Fase-9-comment block
  // above for why the Todos/Enviados/Fallidos filter was removed.
  const { data, isLoading, isError } = useMessageLogs({
    search: search || undefined,
    status: MessageLogStatus.Failed,
    type: typeFilter === 'all' ? undefined : typeFilter,
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

  // Fase 9 — Aviso's automatic-send status, same widget shape as the
  // overdue reminder's above (mirrored per docs/phasesClient/
  // PHASE_9_MESSAGE_TYPES.md), living here since this is already "the
  // page about automatic sends" (see the Fase 5 comment on the block
  // above).
  const { data: upcomingDueCronStatus } = useUpcomingDueCronStatus();
  const pauseUpcomingDueCron = usePauseUpcomingDueCron();
  const resumeUpcomingDueCron = useResumeUpcomingDueCron();

  const logs = data?.items ?? [];
  const meta = data?.meta;
  const rowNumberOffset = ((meta?.page ?? 1) - 1) * (meta?.limit ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Header
          title="Historial de mensajes"
          subtitle="Mensajes de WhatsApp que no se pudieron enviar"
        />
        {isAdmin && (cronStatus || upcomingDueCronStatus) && (
          <div className="flex items-center gap-3">
            {cronStatus && (
              <CronStatusWidget
                label="Recordatorio de mora · Lun, mié y vie, 9:00 a.m."
                running={cronStatus.running}
                onToggle={() =>
                  cronStatus.running ? pauseCron.mutate() : resumeCron.mutate()
                }
                isPending={pauseCron.isPending || resumeCron.isPending}
              />
            )}
            {upcomingDueCronStatus && (
              <CronStatusWidget
                label="Aviso · Diario, 8:00 a.m."
                running={upcomingDueCronStatus.running}
                onToggle={() =>
                  upcomingDueCronStatus.running
                    ? pauseUpcomingDueCron.mutate()
                    : resumeUpcomingDueCron.mutate()
                }
                isPending={
                  pauseUpcomingDueCron.isPending ||
                  resumeUpcomingDueCron.isPending
                }
              />
            )}
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
              <Th>Tipo</Th>
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
              <EmptyRow>
                No hay mensajes fallidos pendientes de revisar.
              </EmptyRow>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-border">
                <Td>
                  {log.client.firstName} {log.client.lastName}
                </Td>
                <Td className="text-muted">
                  {formatPhoneNumber(log.phoneNumber)}
                </Td>
                <Td className="text-muted">{MESSAGE_TYPE_LABELS[log.type]}</Td>
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
        colSpan={7}
        className={`p-6 text-center text-small ${tone === 'error' ? 'text-red-400' : 'text-muted'}`}
      >
        {children}
      </td>
    </tr>
  );
}

// Fase 9: extracted so the overdue and Aviso automatic-send statuses can
// be rendered side by side without duplicating this markup.
function CronStatusWidget({
  label,
  running,
  onToggle,
  isPending,
}: {
  label: string;
  running: boolean;
  onToggle: () => void;
  isPending: boolean;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded border border-border bg-surface px-5 py-3.5">
      <span
        className={`size-2 shrink-0 rounded-full ${running ? 'bg-[#22c55e]' : 'bg-[#eab308]'}`}
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-small font-medium text-white">
          Envío automático — {running ? 'Activo' : 'Pausado'}
        </span>
        <span className="text-meta text-muted">{label}</span>
      </div>
      <button
        type="button"
        onClick={onToggle}
        disabled={isPending}
        className="ml-2 rounded border border-border bg-input px-4 py-2 text-small text-muted hover:text-white disabled:opacity-50"
      >
        {running ? 'Pausar' : 'Reanudar'}
      </button>
    </div>
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
