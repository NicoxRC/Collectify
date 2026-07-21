import { useState } from 'react';

interface MarkAsPaidDialogProps {
  loanLabel: string;
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
}

// Stands in for Figma F-22 "Cambiar estado", which offered a 4-way picker
// (Al día / Pagado / En mora / Congelado). Al día and En mora aren't
// stored states — they're derived automatically from overdueDays
// (docs/DATABASE.md) — and Congelado doesn't exist on the backend at all.
// The only real action is closing a loan out as paid manually (e.g. the
// client paid in cash outside the system), so this is a single
// confirmation for that one action instead of a selector with three
// options that don't do anything. See apps/client/docs/DESIGN_TOKENS.md
// "Known design/backend gaps".
export function MarkAsPaidDialog({
  loanLabel,
  onConfirm,
  onClose,
}: MarkAsPaidDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-[420px] rounded-lg border border-border bg-surface px-8 py-7">
        <h2 className="text-[16px] font-medium text-white">
          Marcar préstamo como pagado
        </h2>
        <p className="mt-2.5 text-small text-muted">
          ¿Confirmas que {loanLabel} fue pagado por fuera del sistema (ej.
          efectivo)? Se marcará el préstamo y todas sus cuotas pendientes como
          pagadas. Esta acción no registra un pago individual por cada cuota.
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
            {isSubmitting ? 'Guardando…' : 'Sí, marcar como pagado'}
          </button>
        </div>
      </div>
    </div>
  );
}
