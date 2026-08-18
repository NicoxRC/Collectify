import { useEffect, useState } from 'react';

import { Header } from '@/components/layout/Header';
import { useClients } from '@/features/clients/useClients';
import { MESSAGE_TYPE_LABELS } from '@/features/messageTemplates/messageTemplatesApi';
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

import type { Client } from '@/features/clients/clientsApi';
import type {
  MessageTemplate,
  MessageType,
} from '@/features/messageTemplates/messageTemplatesApi';

// content stays read-only after the backend refactor (main, PR #16 on the
// backend side) — templates are fixed per message type, editable only via
// a migration, since WhatsApp only lets a business initiate a conversation
// through a Meta-approved template. See docs/DATABASE.md "Changed after
// Phase 9".
//
// Phase 18 adds two things that ARE admin-editable per template: the
// curated audience (group of clients) and the cron schedule — all 4 types
// now have one, not just overdue/upcoming-due. The old pause/resume widget
// that used to live on MessageLogsPage moved here and was generalized,
// since a schedule is a property of the template/type, not of the failed-
// sends list. See docs/phasesClient/PHASE_18_MESSAGE_AUDIENCES.md.
export function MessageTemplatesPage() {
  const { data: templates, isLoading, isError } = useMessageTemplates();

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

      <div className="grid grid-cols-2 gap-4">
        {templates?.map((template) => (
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
              <TemplateCronControl template={template} />
            </div>

            <div className="border-t border-border pt-3">
              <TemplateAudienceEditor type={template.type} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TemplateCronControl({ template }: { template: MessageTemplate }) {
  const { data: cronStatus } = useCronStatus(template.type);
  const pauseCron = usePauseCron(template.type);
  const resumeCron = useResumeCron(template.type);
  const updateSchedule = useUpdateCronSchedule(template.type);

  const [scheduleInput, setScheduleInput] = useState(
    template.cronExpression ?? '',
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Keeps the input in sync after a successful save (or if another admin
  // changed it) without fighting the admin's own in-progress typing.
  useEffect(() => {
    setScheduleInput(template.cronExpression ?? '');
  }, [template.cronExpression]);

  const isTogglePending = pauseCron.isPending || resumeCron.isPending;

  const handleSaveSchedule = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setScheduleError(null);
    try {
      await updateSchedule.mutateAsync(scheduleInput.trim());
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

      <form onSubmit={handleSaveSchedule} className="flex items-center gap-2">
        <input
          value={scheduleInput}
          onChange={(event) => setScheduleInput(event.target.value)}
          placeholder="Expresión cron, ej: 0 9 * * 1,3,5"
          className="h-9 flex-1 rounded border border-border bg-input px-3 text-meta text-white placeholder-mid focus:outline-none"
        />
        <button
          type="submit"
          disabled={updateSchedule.isPending || !scheduleInput.trim()}
          className="shrink-0 rounded border border-border bg-input px-3 py-1.5 text-meta text-muted hover:text-white disabled:opacity-50"
        >
          {updateSchedule.isPending ? 'Guardando…' : 'Guardar horario'}
        </button>
      </form>
      {scheduleError && (
        <p className="text-meta text-red-400">{scheduleError}</p>
      )}
    </div>
  );
}

// Additive audience (overdue/upcoming_due/new_loan) or the whole recipient
// list (account_summary) — see the entity comment on
// apps/api/src/whatsapp/entities/messageAudience.entity.ts. This editor
// doesn't know or care which; it's the same "curated group of clients"
// control either way.
function TemplateAudienceEditor({ type }: { type: MessageType }) {
  const { data: audience, isLoading } = useMessageAudience(type);
  const updateAudience = useUpdateMessageAudience(type);

  const [selectedClients, setSelectedClients] = useState<Client[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: clientResults } = useClients({
    search: clientSearch,
    isActive: true,
  });

  // PUT replaces the whole list — local edits accumulate here and are only
  // sent on "Guardar grupo", not on every add/remove.
  useEffect(() => {
    if (audience) {
      setSelectedClients(audience.clients);
      setIsDirty(false);
    }
  }, [audience]);

  const addClient = (client: Client) => {
    setSelectedClients((prev) =>
      prev.some((existing) => existing.id === client.id)
        ? prev
        : [...prev, client],
    );
    setClientSearch('');
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

      {isLoading ? (
        <p className="text-meta text-muted">Cargando…</p>
      ) : (
        <>
          <div className="relative">
            <input
              value={clientSearch}
              onChange={(event) => setClientSearch(event.target.value)}
              placeholder="Buscar cliente por nombre o cédula…"
              className="h-9 w-full rounded border border-border bg-input px-3 text-meta text-white placeholder-mid focus:outline-none"
            />
            {clientSearch && (clientResults?.items.length ?? 0) > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded border border-border bg-input shadow-lg">
                {clientResults!.items.slice(0, 5).map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => addClient(client)}
                    className="flex w-full flex-col items-start gap-0.5 px-3.5 py-2 text-left hover:bg-border"
                  >
                    <span className="text-control text-white">
                      {client.firstName} {client.lastName}
                    </span>
                    <span className="text-meta text-muted">
                      CC {client.documentNumber}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedClients.length === 0 ? (
            <p className="text-meta text-muted">Sin clientes en el grupo.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
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
    </div>
  );
}
