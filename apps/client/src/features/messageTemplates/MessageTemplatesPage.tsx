import { useState } from 'react';

import { Header } from '@/components/layout/Header';
import { useAuth } from '@/features/auth/useAuth';
import { ActivateTemplateDialog } from '@/features/messageTemplates/ActivateTemplateDialog';
import { MessageTemplateForm } from '@/features/messageTemplates/MessageTemplateForm';
import {
  useActivateMessageTemplate,
  useCreateMessageTemplate,
  useDeleteMessageTemplate,
  useMessageTemplates,
  useUpdateMessageTemplate,
} from '@/features/messageTemplates/useMessageTemplates';

import type { MessageTemplate } from '@/features/messageTemplates/messageTemplatesApi';

// Matches Figma F-25 "Plantillas — Desktop 1440", scoped to type=overdue
// only (client's explicit choice — see DESIGN_TOKENS.md "Known
// design/backend gaps"). Departures from the mockup:
//   - No "Categoría" text and no "Automático"/"Manual" badge on cards —
//     neither is a real column on MessageTemplate.
//   - Only "Recordatorio de mora"-type cards can ever appear here; Figma's
//     "Pago próximo a vencer"/"Pago recibido"/"Mensaje manual" examples
//     either belong to other message types (out of scope) or don't
//     correspond to a real type at all.
export function MessageTemplatesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: templates, isLoading, isError } = useMessageTemplates();
  const createTemplate = useCreateMessageTemplate();
  const updateTemplate = useUpdateMessageTemplate();
  const activateTemplate = useActivateMessageTemplate();
  const deleteTemplate = useDeleteMessageTemplate();

  const [isCreating, setIsCreating] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<MessageTemplate | null>(null);
  const [activatingTemplate, setActivatingTemplate] =
    useState<MessageTemplate | null>(null);

  const activeTemplate = templates?.find((template) => template.isActive);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <Header
          title="Plantillas de mensaje"
          subtitle="Solo ADMIN — Se envía la plantilla marcada como Activa"
        />
        {isAdmin && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="h-fit rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-white/90"
          >
            + Nueva plantilla
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 rounded border border-blue-900 bg-[#071a2e] px-3.5 py-2.5 text-small text-blue-300">
        <span className="size-1.5 shrink-0 rounded-full bg-blue-400" />
        Solo una plantilla puede estar activa a la vez para cada tipo de
        mensaje. Al activar una, las demás plantillas del mismo tipo se
        desactivan automáticamente.
      </div>

      {isLoading && <p className="text-small text-muted">Cargando…</p>}
      {isError && (
        <p className="text-small text-red-400" role="alert">
          No se pudieron cargar las plantillas.
        </p>
      )}
      {!isLoading && !isError && templates?.length === 0 && (
        <p className="text-small text-muted">
          Todavía no hay plantillas de recordatorio de mora.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        {templates?.map((template) => (
          <div
            key={template.id}
            className="flex flex-col gap-2.5 rounded bg-surface p-5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-card-title font-medium text-white">
                  {template.name}
                </span>
                <span
                  className={`rounded-[3px] border px-2 py-[3px] text-meta font-medium ${
                    template.isActive
                      ? 'border-[#22c55e] bg-[#051e0e] text-[#22c55e]'
                      : 'border-border bg-input text-muted'
                  }`}
                >
                  {template.isActive ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTemplate(template)}
                    className="rounded-[3px] border border-border bg-input px-2.5 py-1 text-meta text-muted hover:text-white"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    disabled={template.isActive}
                    onClick={() => setActivatingTemplate(template)}
                    className="rounded-[3px] border border-border bg-input px-2.5 py-1 text-meta text-muted hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Activar
                  </button>
                </div>
              )}
            </div>
            <p className="line-clamp-2 text-small text-muted">
              {template.content}
            </p>
          </div>
        ))}
      </div>

      {isCreating && (
        <MessageTemplateForm
          onClose={() => setIsCreating(false)}
          onSubmit={(input) => createTemplate.mutateAsync(input)}
        />
      )}

      {editingTemplate && (
        <MessageTemplateForm
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSubmit={(input) =>
            updateTemplate.mutateAsync({ id: editingTemplate.id, input })
          }
          onDelete={() => deleteTemplate.mutateAsync(editingTemplate.id)}
        />
      )}

      {activatingTemplate && (
        <ActivateTemplateDialog
          templateName={activatingTemplate.name}
          currentlyActiveName={activeTemplate?.name ?? null}
          onConfirm={() => activateTemplate.mutateAsync(activatingTemplate.id)}
          onClose={() => setActivatingTemplate(null)}
        />
      )}
    </div>
  );
}
