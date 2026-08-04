import { Header } from '@/components/layout/Header';
import { MESSAGE_TYPE_LABELS } from '@/features/messageTemplates/messageTemplatesApi';
import { useMessageTemplates } from '@/features/messageTemplates/useMessageTemplates';

// Read-only after the backend refactor (main, PR #16 on the backend
// side): templates are fixed per message type, not admin-editable
// (updating content is now a migration — see docs/DATABASE.md "Changed
// after Phase 9"). Originally built as full CRUD against the old
// isActive/create/update/activate/delete contract; that contract no
// longer exists. See apps/client/docs/DESIGN_TOKENS.md "Known
// design/backend gaps".
//
// Fase 9: shows all four types now (previously scoped to `overdue` only,
// see useMessageTemplates.ts), each card labeled with its type so the
// admin knows which of the four flows each template belongs to.
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
            className="flex flex-col gap-2.5 rounded bg-surface p-5"
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
          </div>
        ))}
      </div>
    </div>
  );
}
