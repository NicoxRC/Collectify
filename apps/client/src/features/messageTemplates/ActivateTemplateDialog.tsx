import { useState } from 'react';

import { useEscapeKey } from '@/lib/useEscapeKey';

interface ActivateTemplateDialogProps {
  templateName: string;
  currentlyActiveName: string | null;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}

// Matches Figma F-28 "Activar plantilla — Dialog Desktop". Same
// confirmation-dialog pattern as DeactivateClientDialog.tsx /
// MarkAsPaidDialog.tsx.
export function ActivateTemplateDialog({
  templateName,
  currentlyActiveName,
  onConfirm,
  onClose,
}: ActivateTemplateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEscapeKey(onClose);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-lg border border-border bg-surface px-8 py-7">
        <h2 className="text-card-title font-medium text-white">
          Activar plantilla
        </h2>
        <p className="mt-2.5 text-small text-muted">
          ¿Estás seguro de que deseas activar &apos;{templateName}&apos;?
        </p>

        {currentlyActiveName && (
          <div className="mt-4 rounded border border-[#5a4008] bg-[#231b01] px-3.5 py-2.5 text-small text-[#eab308]">
            Esto desactivará automáticamente la plantilla &apos;
            {currentlyActiveName}&apos; (actualmente activa).
          </div>
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
            className="rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Activando…' : 'Sí, activar plantilla'}
          </button>
        </div>
      </div>
    </div>
  );
}
