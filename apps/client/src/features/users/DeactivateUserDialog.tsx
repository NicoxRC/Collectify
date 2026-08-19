import { useState } from 'react';

import { useEscapeKey } from '@/lib/useEscapeKey';

interface DeactivateUserDialogProps {
  userName: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}

// Mirrors DeactivateClientDialog.tsx — same confirm-before-lockout pattern,
// applied here to a company account instead of a client.
export function DeactivateUserDialog({
  userName,
  onConfirm,
  onClose,
}: DeactivateUserDialogProps) {
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
      <div className="w-full max-w-[400px] rounded-lg border border-border bg-surface px-8 py-7">
        <h2 className="text-card-title font-medium text-white">
          Desactivar usuario
        </h2>
        <p className="mt-2.5 text-small text-muted">
          ¿Estás seguro de que deseas desactivar a {userName}? No podrá iniciar
          sesión hasta que sea reactivado.
        </p>

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
            className="rounded border border-subtle bg-border px-4 py-2.5 text-small text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Desactivando…' : 'Sí, desactivar'}
          </button>
        </div>
      </div>
    </div>
  );
}
