import { useRef, useState } from 'react';

import { CloseButton } from '@/components/ui/CloseButton';
import { DeleteTemplateDialog } from '@/features/messageTemplates/DeleteTemplateDialog';
import { ApiError } from '@/lib/apiClient';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type { MessageTemplate } from '@/features/messageTemplates/messageTemplatesApi';
import type { FormEvent, ReactNode } from 'react';

interface MessageTemplateFormProps {
  // Present = editing; absent = creating. Matches ClientForm.tsx/
  // LoanForm.tsx's shared create/edit pattern.
  template?: MessageTemplate;
  onSubmit: (input: { name: string; content: string }) => Promise<unknown>;
  onDelete?: () => Promise<unknown>;
  onClose: () => void;
}

// Matches Figma F-26/29 "Nueva plantilla" and F-27 "Editar plantilla" —
// with one significant departure from what those frames show, confirmed
// against apps/api/src/whatsapp/messageRenderer.ts: the per-installment
// line ("1️⃣ La cuota No. X del pagaré #Y por $Z...") is FIXED, not
// editable — only the outer wrapper (greeting + where the list/total go)
// is admin content. So the variable buttons here are
// {{clientFullName}}/{{installmentsList}}/{{grandTotal}} (the three the
// renderer actually substitutes), not Figma's
// {{nombre}}/{{dias}}/{{monto}}/{{fecha_venc}} (which would imply a
// single-installment template, which isn't how this message type works —
// it's one consolidated message per client covering every overdue
// installment across all their loans). "Categoría" field dropped — no such
// column on MessageTemplate, only a fixed `type` enum, and this phase only
// ever creates type=overdue templates. See DESIGN_TOKENS.md.
export function MessageTemplateForm({
  template,
  onSubmit,
  onDelete,
  onClose,
}: MessageTemplateFormProps) {
  const isEditing = Boolean(template);
  const [name, setName] = useState(template?.name ?? '');
  const [content, setContent] = useState(template?.content ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [contentError, setContentError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEscapeKey(onClose);

  const insertVariable = (token: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => prev + token);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    setContentError(null);
    // Restore focus/cursor after the inserted token on the next tick.
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    let hasError = false;
    if (!name.trim()) {
      setNameError('El nombre de la plantilla es obligatorio.');
      hasError = true;
    }
    if (!content.trim()) {
      setContentError('El mensaje es obligatorio.');
      hasError = true;
    }
    if (hasError) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), content });
      onClose();
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo guardar la plantilla. Intenta de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-[820px] overflow-y-auto rounded-lg border border-border bg-surface px-8 py-7">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-white">
            {isEditing ? 'Editar plantilla' : 'Nueva plantilla'}
          </h2>
          <CloseButton onClick={onClose} />
        </div>
        <p className="mt-1 text-label text-muted">
          {isEditing
            ? `Editando: ${template!.name}${template!.isActive ? ' · Plantilla activa' : ''}`
            : 'Solo administradores · El mensaje de cada cuota vencida tiene un formato fijo — aquí solo editas el saludo y dónde va la lista y el total.'}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-2 gap-6">
          <div className="flex flex-col gap-3.5">
            <Field label="Nombre de la plantilla" error={nameError}>
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(null);
                }}
                placeholder="Ej: Recordatorio de mora"
                className={inputClassName(Boolean(nameError))}
              />
            </Field>

            <Field label="Mensaje" error={contentError}>
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(event) => {
                  setContent(event.target.value);
                  setContentError(null);
                }}
                placeholder="Escribe el mensaje aquí. Usa las variables de abajo para personalizar."
                rows={8}
                className={`${inputClassName(Boolean(contentError))} resize-none`}
              />
            </Field>

            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium tracking-[0.4px] text-muted">
                Variables disponibles — clic para insertar
              </span>
              <div className="flex flex-wrap gap-1.5">
                {AVAILABLE_VARIABLES.map((variable) => (
                  <button
                    key={variable.token}
                    type="button"
                    onClick={() => insertVariable(variable.token)}
                    title={variable.description}
                    className="rounded border border-blue-900 bg-blue-950 px-2 py-1 text-meta text-blue-300 hover:text-blue-200"
                  >
                    {variable.token}
                  </button>
                ))}
              </div>
              <span className="text-meta text-mid">
                Las variables se sustituyen por datos reales al momento del
                envío. El listado de cuotas vencidas tiene un formato fijo — no
                editable.
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium tracking-[0.4px] text-muted">
              Preview en tiempo real
            </span>
            <div className="rounded border border-blue-900 bg-input p-3.5">
              <div className="flex items-center gap-1.5 text-meta text-blue-300">
                <span className="size-1.5 rounded-full bg-blue-400" />
                Vista previa con datos de ejemplo
              </div>
              <div className="mt-2.5 rounded bg-[#0a240a] p-3">
                <p className="text-meta text-muted">WhatsApp · Collectify</p>
                <p className="mt-1 whitespace-pre-wrap text-small text-white">
                  {content
                    ? renderFormattedPreview(renderPreview(content))
                    : 'Escribe un mensaje para ver la vista previa…'}
                </p>
              </div>
              <p className="mt-1.5 text-meta text-mid">
                → Variables sustituidas con datos de ejemplo
              </p>
            </div>
            <span className="text-meta text-mid">
              Caracteres: {content.length} — el mensaje final puede variar según
              los datos reales del cliente.
            </span>
            <span className="text-meta text-mid">
              WhatsApp da formato al texto: *negrita*, _cursiva_, ~tachado~ — se
              aplican automáticamente al enviar, sin que tengas que hacer nada
              más.
            </span>
          </div>

          {formError && (
            <p className="col-span-2 text-small text-red-400" role="alert">
              {formError}
            </p>
          )}

          <div className="col-span-2 mt-6 flex items-center justify-between">
            {isEditing && onDelete ? (
              <button
                type="button"
                onClick={() => setIsDeleting(true)}
                className="rounded border border-red-900 bg-red-950 px-4 py-2.5 text-small text-red-300 hover:text-red-200"
              >
                Eliminar plantilla
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-border bg-input px-4 py-2.5 text-small text-muted hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? 'Guardando…'
                  : isEditing
                    ? 'Guardar cambios'
                    : 'Guardar plantilla'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {isDeleting && template && onDelete && (
        <DeleteTemplateDialog
          templateName={template.name}
          onConfirm={onDelete}
          onClose={() => {
            setIsDeleting(false);
            onClose();
          }}
        />
      )}
    </div>
  );
}

const AVAILABLE_VARIABLES = [
  { token: '{{clientFullName}}', description: 'Nombre completo del cliente' },
  {
    token: '{{installmentsList}}',
    description: 'Listado de cuotas vencidas (formato fijo)',
  },
  {
    token: '{{grandTotal}}',
    description:
      'Suma total a pagar — ya incluye el signo $, no lo escribas tú',
  },
];

const SAMPLE_DATA = {
  clientFullName: 'Carlos Mendoza',
  installmentsList:
    '1️⃣ La cuota No. 3 del pagaré #P-001 por $158.000 (incluidos intereses) venció hace 14 días.',
  grandTotal: '$158.000',
};

function renderPreview(content: string): string {
  return content
    .replaceAll('{{clientFullName}}', SAMPLE_DATA.clientFullName)
    .replaceAll('{{installmentsList}}', SAMPLE_DATA.installmentsList)
    .replaceAll('{{grandTotal}}', SAMPLE_DATA.grandTotal);
}

// WhatsApp applies its own formatting to the raw message text — no HTML or
// markdown library involved, just these three markers. This only affects
// how the preview LOOKS; the actual send (whatsapp.service.ts) already
// works today with these markers, since the message is sent as plain text
// and WhatsApp's client renders them on the recipient's end.
const WHATSAPP_FORMAT_REGEX = /\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;

function renderFormattedPreview(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  WHATSAPP_FORMAT_REGEX.lastIndex = 0;
  while ((match = WHATSAPP_FORMAT_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const [, bold, italic, strikethrough] = match;
    if (bold !== undefined) {
      nodes.push(<strong key={key++}>{bold}</strong>);
    } else if (italic !== undefined) {
      nodes.push(<em key={key++}>{italic}</em>);
    } else if (strikethrough !== undefined) {
      nodes.push(<s key={key++}>{strikethrough}</s>);
    }
    lastIndex = WHATSAPP_FORMAT_REGEX.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

const inputClassName = (hasError: boolean): string => {
  const base =
    'w-full rounded border bg-input px-3.5 py-2.5 text-control text-white placeholder-mid focus:outline-none';
  return hasError
    ? `${base} border-red-500 focus:border-red-500`
    : `${base} border-border focus:border-subtle`;
};

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-medium tracking-[0.4px] text-muted">
        {label}
      </span>
      {children}
      {error && (
        <span className="text-meta text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
