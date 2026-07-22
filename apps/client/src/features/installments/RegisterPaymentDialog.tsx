import { useState } from 'react';

import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { ApiError } from '@/lib/apiClient';
import { formatCurrency } from '@/lib/format';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type { Installment } from '@/features/installments/installmentsApi';
import type { FormEvent } from 'react';

interface RegisterPaymentDialogProps {
  // The installment this payment applies to. The API only accepts
  // payments per-installment (POST /installments/:id/payments) — there is
  // no loan-level "apply to whatever's next" endpoint, unlike what F-20's
  // simple "Préstamo #P-001 — Saldo: $800" header implies. The caller
  // decides which installment (see LoanDetailPage: the top "Registrar
  // pago" button targets the oldest pending one automatically, matching
  // Figma's no-picker flow; the cuotas table also offers a "Pagar" action
  // per row for when a specific installment needs to be targeted).
  installment: Installment;
  loanLabel: string;
  onClose: () => void;
  onConfirm: (input: {
    amountPaid: number;
    paidAt: string;
    observation?: string;
  }) => Promise<unknown>;
}

// `new Date().toISOString().slice(0, 10)` (the obvious way to get
// "today") is wrong here: .toISOString() converts the current instant to
// UTC before formatting, which rolls the calendar date forward for any
// timezone behind UTC — e.g. America/Bogota (UTC-5) turns 21 jul 8:00pm
// local into 22 jul 1:00am UTC, showing tomorrow's date as the default.
// This reads the LOCAL calendar day directly instead (same bug class as
// formatDateOnly/dueDateMath.ts, opposite direction: those force UTC to
// stop the date from rolling BACK; this forces local to stop it rolling
// FORWARD).
function todayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Matches Figma F-20 "Registrar pago — Modal Desktop" exactly — the only
// one of this phase's screens with no design/backend gap at all.
export function RegisterPaymentDialog({
  installment,
  loanLabel,
  onClose,
  onConfirm,
}: RegisterPaymentDialogProps) {
  // totalDue is amount + accrued interest (interestRate / 30 × overdueDays)
  // — that division routinely produces long repeating decimals (e.g.
  // 108333.3333333333). The business only ever deals in whole pesos
  // (formatCurrency's convention everywhere else in the app), so the
  // default shown here is rounded the same way rather than dumping the raw
  // float into the field. Still fully editable — this only affects the
  // pre-filled default.
  const [amountPaid, setAmountPaid] = useState(
    Math.round(installment.totalDue),
  );
  const [paidAt, setPaidAt] = useState(todayDateString());
  const [observation, setObservation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEscapeKey(onClose);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const amount = amountPaid;
    if (!(amount > 0)) {
      setError('El monto del pago debe ser mayor a 0.');
      return;
    }
    if (!paidAt) {
      setError('La fecha de pago es obligatoria.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        amountPaid: amount,
        paidAt,
        observation: observation.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo registrar el pago. Intenta de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-[440px] rounded-lg border border-border bg-surface px-8 py-7">
        <h2 className="text-[16px] font-medium text-white">Registrar pago</h2>
        <p className="mt-1 text-label text-muted">
          {loanLabel} — Cuota {installment.installmentNumber} · Saldo{' '}
          {formatCurrency(installment.totalDue)}
        </p>

        <div className="mt-5 border-t border-border" />

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
          <div className="flex gap-4">
            <Field label="Monto del pago">
              <CurrencyInput
                value={amountPaid}
                onChange={setAmountPaid}
                className={inputClassName}
              />
            </Field>
            <Field label="Fecha de pago">
              <DatePicker
                value={paidAt}
                onChange={setPaidAt}
                className={inputClassName}
              />
            </Field>
          </div>

          <Field label="Observación (opcional)">
            <textarea
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder="Ej: pago recibido en efectivo"
              rows={3}
              // Not inputClassName — that has a fixed h-[42px] meant for
              // single-line inputs, which fights with rows={3} and squeezes
              // the text with no vertical padding. py-2.5 instead lets the
              // textarea size itself naturally.
              className="w-full resize-none rounded border border-border bg-input px-3.5 py-2 text-control text-white placeholder-mid focus:border-subtle focus:outline-none"
            />
          </Field>

          {error && (
            <p className="text-small text-red-400" role="alert">
              {error}
            </p>
          )}

          <div className="mt-2.5 border-t border-border" />

          <div className="mt-2 flex items-center justify-end gap-3">
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
              {isSubmitting ? 'Registrando…' : 'Registrar pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClassName =
  'h-[42px] w-full rounded border border-border bg-input px-3.5 text-control text-white placeholder-mid focus:border-subtle focus:outline-none';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      <span className="text-[10px] font-medium tracking-[0.4px] text-muted">
        {label}
      </span>
      {children}
    </div>
  );
}
