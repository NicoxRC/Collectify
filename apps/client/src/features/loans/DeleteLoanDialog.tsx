import { useState } from 'react';

import { ApiError } from '@/lib/apiClient';
import { useEscapeKey } from '@/lib/useEscapeKey';

interface DeleteLoanDialogProps {
  loanLabel: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}

// Phase 30 — no Figma frame exists for this (see DESIGN_TOKENS.md's
// "Known design/backend gaps"); styled after the closest existing
// confirmation, DeactivateClientDialog. Unlike that one, this surfaces
// the api's rejection message inline instead of letting it fail
// silently — the phase brief explicitly calls out the race-condition
// case (a payment was registered between page load
// and the delete click, so the backend's own no-payments check rejects it
// even though the button looked enabled) as something to show clearly
// rather than as a generic failure.
export function DeleteLoanDialog({
  loanLabel,
  onConfirm,
  onClose,
}: DeleteLoanDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(onClose);

  const handleConfirm = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo eliminar el préstamo. Intenta de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-lg border border-border bg-surface px-8 py-7">
        <h2 className="text-[16px] font-medium text-white">
          Eliminar préstamo
        </h2>
        <p className="mt-2.5 text-small text-muted">
          ¿Estás seguro de que deseas eliminar {loanLabel}? Esta acción no se
          puede deshacer desde el panel.
        </p>

        <div className="mt-6 border-t border-border" />

        {error && (
          <p className="mt-4 text-small text-red-400" role="alert">
            {error}
          </p>
        )}

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
            className="rounded border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-small text-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Eliminando…' : 'Sí, eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}
