import { useState } from 'react';

import { ApiError } from '@/lib/apiClient';
import { useEscapeKey } from '@/lib/useEscapeKey';

interface DeleteTemplateDialogProps {
  templateName: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}

// Backs the "Eliminar plantilla" button in F-27 — Figma shows it as a
// plain button inside the edit modal with no confirmation step, but every
// other destructive action in this app (Desactivar cliente, Marcar
// préstamo como pagado) goes through a confirm dialog first, so this
// follows the same convention rather than deleting on a single click.
export function DeleteTemplateDialog({
  templateName,
  onConfirm,
  onClose,
}: DeleteTemplateDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEscapeKey(onClose);

  const handleConfirm = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      // Most likely cause: trying to delete the currently active template
      // — the API rejects that with a 400 (see messageTemplatesApi.ts).
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo eliminar la plantilla. Intenta de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-[400px] rounded-lg border border-border bg-surface px-8 py-7">
        <h2 className="text-card-title font-medium text-white">
          Eliminar plantilla
        </h2>
        <p className="mt-2.5 text-small text-muted">
          ¿Estás seguro de que deseas eliminar &apos;{templateName}&apos;? Esta
          acción no se puede deshacer.
        </p>

        {error && (
          <p className="mt-3 text-small text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 border-t border-border" />

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border bg-input px-4 py-2.5 text-small text-muted hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting}
            className="rounded border border-red-900 bg-red-950 px-4 py-2.5 text-small text-red-300 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Eliminando…' : 'Sí, eliminar plantilla'}
          </button>
        </div>
      </div>
    </div>
  );
}
