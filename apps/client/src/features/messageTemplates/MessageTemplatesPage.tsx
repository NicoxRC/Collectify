import { useEffect, useState } from 'react';

import { CloseButton } from '@/components/ui/CloseButton';
import { Header } from '@/components/layout/Header';
import { useClients } from '@/features/clients/useClients';
import {
  buildCronExpression,
  DEFAULT_SCHEDULE_CONFIG,
  parseCronExpression,
} from '@/features/messageTemplates/cronScheduleUtils';
import {
  MESSAGE_TYPE_LABELS,
  MessageType,
} from '@/features/messageTemplates/messageTemplatesApi';
import {
  useMessageAudience,
  useMessageTemplates,
  useUpdateMessageAudience,
} from '@/features/messageTemplates/useMessageTemplates';
import {
  useCronStatus,
  usePauseCron,
  useResumeCron,
  useUpdateCronSchedule,
} from '@/features/whatsapp/useWhatsapp';
import { ApiError } from '@/lib/apiClient';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type {
  Periodicity,
  ScheduleConfig,
} from '@/features/messageTemplates/cronScheduleUtils';
import type { Client } from '@/features/clients/clientsApi';
import type { MessageTemplate } from '@/features/messageTemplates/messageTemplatesApi';

// content stays read-only after the backend refactor (main, PR #16 on the
// backend side) — templates are fixed per message type, editable only via
// a migration, since WhatsApp only lets a business initiate a conversation
// through a Meta-approved template. See docs/DATABASE.md "Changed after
// Phase 9".
//
// Phase 18 added two things that ARE admin-editable per template: a
// curated audience (group of clients) and a cron schedule. Corrected after
// client QA (2026-08-18) — see docs/phases/PHASE_18_MESSAGE_AUDIENCES.md
// "Extended after client QA":
//   - new_loan has NEITHER a schedule NOR an audience — it's sent exactly
//     once, synchronously, at loan creation.
//   - account_summary has NO audience — it's sent automatically to every
//     client with an active loan, but keeps its schedule.
//   - overdue/upcoming_due keep both, with the audience now a required
//     filter (not additive) and bulk client selection added to the editor.
// Grid pairing, distinct from MESSAGE_TYPE_ORDER (used elsewhere for
// filter dropdowns etc.) — new_loan and account_summary are both short
// cards (neither has a schedule+audience combo), overdue and upcoming_due
// are both tall (schedule + audience editor). Pairing short with short and
// tall with tall keeps each grid row's two cards close in height instead
// of a short card being stretched to match a tall neighbor (which is also
// why the grid itself uses `items-start` below, so a card never stretches
// past its own content regardless of pairing).
const GRID_DISPLAY_ORDER: MessageType[] = [
  MessageType.NewLoan,
  MessageType.AccountSummary,
  MessageType.UpcomingDue,
  MessageType.Overdue,
];

export function MessageTemplatesPage() {
  const { data: templates, isLoading, isError } = useMessageTemplates();
  const orderedTemplates = templates
    ? [...templates].sort(
        (a, b) =>
          GRID_DISPLAY_ORDER.indexOf(a.type) -
          GRID_DISPLAY_ORDER.indexOf(b.type),
      )
    : templates;

  return (
    <div className="flex flex-col gap-5">
      <Header
        title="Plantillas de mensaje"
        subtitle="Solo ADMIN — Contenido fijo, no editable"
      />

      {isLoading && <p className="text-small text-muted">Cargando…</p>}
      {isError && (
        <p className="text-small text-red-400" role="alert">
          No se pudieron cargar las plantillas.
        </p>
      )}
      {!isLoading && !isError && templates?.length === 0 && (
        <p className="text-small text-muted">Todavía no hay plantillas.</p>
      )}

      <div className="grid grid-cols-2 items-start gap-4">
        {orderedTemplates?.map((template) => (
          <div
            key={template.id}
            className="flex flex-col gap-3.5 rounded bg-surface p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-card-title font-medium text-white">
                {template.name}
              </span>
              <span className="rounded-[3px] border border-border bg-input px-2 py-[3px] text-meta font-medium text-muted">
                {MESSAGE_TYPE_LABELS[template.type]}
              </span>
            </div>
            <p className="whitespace-pre-line text-small text-muted">
              {template.content}
            </p>

            <div className="border-t border-border pt-3">
              {template.type === MessageType.NewLoan ? (
                <p className="text-meta text-muted">
                  Se envía automáticamente, una sola vez, al crear el préstamo —
                  no tiene horario ni reintento programado.
                </p>
              ) : (
                <TemplateCronControl template={template} />
              )}
            </div>

            <div className="border-t border-border pt-3">
              {template.type === MessageType.NewLoan ? (
                <p className="text-meta text-muted">
                  No usa grupo de destinatarios.
                </p>
              ) : template.type === MessageType.AccountSummary ? (
                <p className="text-meta text-muted">
                  Sin grupo — le llega automáticamente a todos los clientes con
                  crédito activo.
                </p>
              ) : (
                <TemplateAudienceEditor type={template.type} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PERIODICITY_OPTIONS: { value: Periodicity; label: string }[] = [
  { value: 'daily', label: 'Cada día' },
  { value: 'weekly', label: 'Cada semana' },
  { value: 'biweekly', label: 'Cada 15 días' },
  { value: 'monthly', label: 'Cada mes' },
];

const DAY_OF_WEEK_OPTIONS = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

const DAY_OF_MONTH_OPTIONS = Array.from(
  { length: 28 },
  (_, index) => index + 1,
);

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

// A friendly periodicity+time picker instead of a raw cron expression
// (added after client QA, 2026-08-18 — see docs/phasesClient/PHASE_18_MESSAGE_AUDIENCES.md).
// Not offered for new_loan, which has no schedule at all — see the parent
// component.
function TemplateCronControl({ template }: { template: MessageTemplate }) {
  const { data: cronStatus } = useCronStatus(template.type);
  const pauseCron = usePauseCron(template.type);
  const resumeCron = useResumeCron(template.type);
  const updateSchedule = useUpdateCronSchedule(template.type);

  const [config, setConfig] = useState<ScheduleConfig>(
    () =>
      parseCronExpression(template.cronExpression) ?? DEFAULT_SCHEDULE_CONFIG,
  );
  const [isDirty, setIsDirty] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Keeps the picker in sync after a successful save (or if another admin
  // changed it) without fighting the admin's own in-progress edits.
  useEffect(() => {
    setConfig(
      parseCronExpression(template.cronExpression) ?? DEFAULT_SCHEDULE_CONFIG,
    );
    setIsDirty(false);
  }, [template.cronExpression]);

  const updateConfig = (changes: Partial<ScheduleConfig>) => {
    setConfig((prev) => ({ ...prev, ...changes }));
    setIsDirty(true);
  };

  const isTogglePending = pauseCron.isPending || resumeCron.isPending;

  const handleSaveSchedule = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setScheduleError(null);
    try {
      await updateSchedule.mutateAsync(buildCronExpression(config));
      setIsDirty(false);
    } catch (error) {
      setScheduleError(
        error instanceof ApiError
          ? error.message
          : 'No se pudo actualizar el horario.',
      );
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`size-2 shrink-0 rounded-full ${
              cronStatus?.running ? 'bg-[#22c55e]' : 'bg-[#eab308]'
            }`}
          />
          <span className="text-small font-medium text-white">
            Envío automático —{' '}
            {cronStatus ? (cronStatus.running ? 'Activo' : 'Pausado') : '—'}
          </span>
        </div>
        {cronStatus && (
          <button
            type="button"
            onClick={() =>
              cronStatus.running ? pauseCron.mutate() : resumeCron.mutate()
            }
            disabled={isTogglePending}
            className="rounded border border-border bg-input px-3 py-1.5 text-meta text-muted hover:text-white disabled:opacity-50"
          >
            {cronStatus.running ? 'Pausar' : 'Reanudar'}
          </button>
        )}
      </div>

      <form onSubmit={handleSaveSchedule} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={config.periodicity}
            onChange={(event) =>
              updateConfig({ periodicity: event.target.value as Periodicity })
            }
            className="h-9 rounded border border-border bg-input px-2 text-meta text-white focus:outline-none"
          >
            {PERIODICITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {config.periodicity === 'weekly' && (
            <select
              value={config.dayOfWeek}
              onChange={(event) =>
                updateConfig({ dayOfWeek: Number(event.target.value) })
              }
              className="h-9 rounded border border-border bg-input px-2 text-meta text-white focus:outline-none"
            >
              {DAY_OF_WEEK_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          {config.periodicity === 'monthly' && (
            <select
              value={config.dayOfMonth}
              onChange={(event) =>
                updateConfig({ dayOfMonth: Number(event.target.value) })
              }
              className="h-9 rounded border border-border bg-input px-2 text-meta text-white focus:outline-none"
            >
              {DAY_OF_MONTH_OPTIONS.map((day) => (
                <option key={day} value={day}>
                  Día {day}
                </option>
              ))}
            </select>
          )}

          <input
            type="time"
            value={`${pad2(config.hour)}:${pad2(config.minute)}`}
            onChange={(event) => {
              const [hour, minute] = event.target.value.split(':').map(Number);
              updateConfig({ hour, minute });
            }}
            className="h-9 rounded border border-border bg-input px-2 text-meta text-white focus:outline-none"
          />

          <button
            type="submit"
            disabled={!isDirty || updateSchedule.isPending}
            className="shrink-0 rounded border border-border bg-input px-3 py-1.5 text-meta text-muted hover:text-white disabled:opacity-50"
          >
            {updateSchedule.isPending ? 'Guardando…' : 'Guardar horario'}
          </button>
        </div>
        {isDirty && (
          <span className="text-meta text-[#eab308]">Cambios sin guardar</span>
        )}
      </form>
      {scheduleError && (
        <p className="text-meta text-red-400">{scheduleError}</p>
      )}
    </div>
  );
}

// For overdue/upcoming_due, the audience is a REQUIRED FILTER as of
// 2026-08-18 (corrected from the original additive/union design — see
// apps/api/src/whatsapp/entities/messageAudience.entity.ts): a client only
// gets that reminder if they're both dynamically overdue/approaching due
// AND in this group. An empty group means nobody gets that reminder, even
// if clients are overdue — hence the warning banner below. Not rendered
// for new_loan or account_summary at all — see the parent component.
//
// Adding clients opens a paginated picker modal (added after client QA,
// 2026-08-18) rather than an inline search+checklist — with potentially
// hundreds of clients, showing them all inline (even capped at 100) isn't
// practical, and a real paginated list is. This panel itself only shows
// the group's current (usually much smaller) membership, with per-client
// removal — no pagination needed there.
function TemplateAudienceEditor({ type }: { type: MessageType }) {
  const { data: audience, isLoading } = useMessageAudience(type);
  const updateAudience = useUpdateMessageAudience(type);

  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // PUT replaces the whole list — local edits accumulate here and are only
  // sent on "Guardar grupo", not on every add/remove.
  useEffect(() => {
    if (audience) {
      setSelectedClients(audience.clients);
      setIsDirty(false);
    }
  }, [audience]);

  const toggleClient = (client: Client) => {
    setSelectedClients((prev) =>
      prev.some((existing) => existing.id === client.id)
        ? prev.filter((existing) => existing.id !== client.id)
        : [...prev, client],
    );
    setIsDirty(true);
  };

  const removeClient = (clientId: string) => {
    setSelectedClients((prev) =>
      prev.filter((client) => client.id !== clientId),
    );
    setIsDirty(true);
  };

  const handleSave = async () => {
    setSaveError(null);
    try {
      await updateAudience.mutateAsync(
        selectedClients.map((client) => client.id),
      );
      setIsDirty(false);
    } catch (error) {
      setSaveError(
        error instanceof ApiError
          ? error.message
          : 'No se pudo guardar el grupo de destinatarios.',
      );
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-small font-medium text-white">
        Grupo de destinatarios
      </span>
      <p className="text-meta text-red-400">
        Solo los clientes de este grupo reciben este mensaje — si el grupo está
        vacío, nadie lo recibe, aunque tenga cuotas vencidas o por vencer.
      </p>

      {isLoading ? (
        <p className="text-meta text-muted">Cargando…</p>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="flex items-center gap-1 self-start rounded border border-border bg-input px-3 py-1.5 text-meta text-white hover:border-subtle"
          >
            {/* An SVG instead of a literal "+" character — the glyph
                rendered visibly clipped at this size. */}
            <svg
              className="size-2.5 shrink-0"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
            >
              <path
                d="M10 4v12M4 10h12"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
            Agregar clientes
          </button>

          <span className="text-meta text-muted">
            {selectedClients.length === 0
              ? 'Sin clientes en el grupo.'
              : `${selectedClients.length} cliente(s) en el grupo:`}
          </span>
          {selectedClients.length > 0 && (
            <ul className="flex max-h-[220px] flex-col gap-1.5 overflow-y-auto">
              {selectedClients.map((client) => (
                <li
                  key={client.id}
                  className="flex items-center justify-between rounded border border-border bg-input px-3 py-1.5"
                >
                  <span className="text-meta text-white">
                    {client.firstName} {client.lastName}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeClient(client.id)}
                    className="text-meta text-muted hover:text-white"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!isDirty || updateAudience.isPending}
              className="self-start rounded border border-border bg-input px-3 py-1.5 text-meta text-muted hover:text-white disabled:opacity-50"
            >
              {updateAudience.isPending ? 'Guardando…' : 'Guardar grupo'}
            </button>
            {isDirty && (
              <span className="text-meta text-[#eab308]">
                Cambios sin guardar
              </span>
            )}
          </div>
          {saveError && <p className="text-meta text-red-400">{saveError}</p>}
        </>
      )}

      {isPickerOpen && (
        <ClientPickerModal
          selectedClients={selectedClients}
          onToggle={toggleClient}
          onClose={() => setIsPickerOpen(false)}
        />
      )}
    </div>
  );
}

const PICKER_PAGE_SIZE = 20;

// Paginated client picker — search narrows the result set, "Agregar
// todos"/"Quitar todos" apply to the current page only (never the whole
// filtered set at once, since with hundreds of clients that could silently
// select far more than intended across pages the admin never looked at).
function ClientPickerModal({
  selectedClients,
  onToggle,
  onClose,
}: {
  selectedClients: Client[];
  onToggle: (client: Client) => void;
  onClose: () => void;
}) {
  useEscapeKey(onClose);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useClients({
    search,
    isActive: true,
    page,
    limit: PICKER_PAGE_SIZE,
  });
  const pageClients = data?.items ?? [];
  const meta = data?.meta;
  const selectedIds = new Set(selectedClients.map((client) => client.id));

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const addAllOnPage = () => {
    for (const client of pageClients) {
      if (!selectedIds.has(client.id)) {
        onToggle(client);
      }
    }
  };

  const removeAllOnPage = () => {
    for (const client of pageClients) {
      if (selectedIds.has(client.id)) {
        onToggle(client);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-[520px] flex-col rounded-lg border border-border bg-surface px-8 py-7">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-white">
            Agregar clientes al grupo
          </h2>
          <CloseButton onClick={onClose} />
        </div>
        <p className="mt-1 text-label text-muted">
          {selectedClients.length} cliente(s) seleccionados en total.
        </p>

        <div className="mt-5 border-t border-border" />

        <div className="mt-4 flex flex-col gap-3 overflow-hidden">
          <input
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            placeholder="Buscar cliente por nombre o cédula…"
            className="h-9 w-full shrink-0 rounded border border-border bg-input px-3 text-meta text-white placeholder-mid focus:outline-none"
          />

          {!isLoading && pageClients.length > 0 && (
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={addAllOnPage}
                className="flex items-center gap-1 text-meta text-muted hover:text-white"
              >
                <svg
                  className="size-2.5 shrink-0"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    d="M10 4v12M4 10h12"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
                Agregar todos en esta página
              </button>
              <button
                type="button"
                onClick={removeAllOnPage}
                className="text-meta text-muted hover:text-red-400"
              >
                Quitar todos en esta página
              </button>
            </div>
          )}

          <div className="flex flex-col gap-1 overflow-y-auto">
            {isLoading ? (
              <p className="text-meta text-muted">Cargando…</p>
            ) : pageClients.length === 0 ? (
              <p className="text-meta text-muted">
                No se encontraron clientes.
              </p>
            ) : (
              pageClients.map((client) => (
                <label
                  key={client.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-border"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(client.id)}
                    onChange={() => onToggle(client)}
                    className="shrink-0"
                  />
                  <span className="text-control text-white">
                    {client.firstName} {client.lastName}
                  </span>
                  <span className="text-meta text-muted">
                    CC {client.documentNumber}
                  </span>
                </label>
              ))
            )}
          </div>

          {meta && meta.total > 0 && (
            <div className="flex shrink-0 items-center justify-between">
              <p className="text-label text-muted">
                Página {meta.page} de {meta.totalPages} · {meta.total}{' '}
                cliente(s)
              </p>
              <div className="flex items-center gap-1">
                <PageButton
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  ←
                </PageButton>
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

        <div className="mt-5 border-t border-border" />

        <div className="mt-4 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-white/90"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

function PageButton({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded border border-border bg-input px-2.5 py-1.5 text-label text-muted disabled:opacity-40"
    >
      {children}
    </button>
  );
}
