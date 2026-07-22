import { useState } from 'react';

import { CloseButton } from '@/components/ui/CloseButton';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import {
  subtractDaysFromDateString,
  subtractMonthsFromDateString,
} from '@/features/loans/dueDateMath';
import { InstallmentFrequency } from '@/features/loans/loansApi';
import { ApiError } from '@/lib/apiClient';
import { formatCurrency } from '@/lib/format';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type { RefinanceLoanInput } from '@/features/loans/loansApi';
import type { FormEvent } from 'react';

interface RefinanceLoanFormProps {
  oldLoanLabel: string;
  // Shown as a reference only — apps/api/src/loans/dto/refinanceLoan.dto.ts
  // is explicit that principalAmount is NOT auto-calculated from this; the
  // admin types the exact renegotiated figure by hand (business decision,
  // not a formula). Same reasoning as RegisterPaymentDialog's pre-filled
  // (but editable) default.
  oldLoanOutstandingBalance: number;
  onSubmit: (input: RefinanceLoanInput) => Promise<unknown>;
  onClose: () => void;
}

type FieldName =
  | 'promissoryNoteNumber'
  | 'principalAmount'
  | 'interestRate'
  | 'firstDueDate'
  | 'totalInstallments'
  | 'installmentAmounts';
type FieldErrors = Partial<Record<FieldName, string>>;

const AMOUNT_SUM_TOLERANCE = 0.01;

// Same even-split helper as LoanForm.tsx — duplicated rather than shared
// since it's a single small pure function and the two forms otherwise
// don't share a base (this one has no client selector).
function splitEvenly(total: number, count: number): number[] {
  if (count <= 0) {
    return [];
  }
  const base = Math.floor(total / count);
  const remainder = Math.round(total - base * count);
  return Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base,
  );
}

// No Figma frame exists for this screen (confirmed with the client) — built
// from scratch, matching LoanForm.tsx's fields/layout/validation exactly
// (same "first installment due date" UX, derived disbursedAt client-side;
// same per-installment breakdown with auto-split) since this is
// structurally the same operation: create a new loan. The only real
// difference is there's no client selector — POST /loans/:id/refinance
// always attaches the new loan to the same client as the one being
// refinanced, enforced server-side.
export function RefinanceLoanForm({
  oldLoanLabel,
  oldLoanOutstandingBalance,
  onSubmit,
  onClose,
}: RefinanceLoanFormProps) {
  const [promissoryNoteNumber, setPromissoryNoteNumber] = useState('');
  const [principalAmount, setPrincipalAmount] = useState(0);
  const [interestRate, setInterestRate] = useState('');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [installmentFrequency, setInstallmentFrequency] = useState(
    InstallmentFrequency.Monthly,
  );
  const [totalInstallments, setTotalInstallments] = useState('');
  const [installmentAmounts, setInstallmentAmounts] = useState<number[]>([]);
  const [amountsManuallyEdited, setAmountsManuallyEdited] = useState(false);
  const [description, setDescription] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEscapeKey(onClose);

  const principal = principalAmount;
  const count = parseInt(totalInstallments, 10) || 0;
  const amountsSum = installmentAmounts.reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const amountsMatchPrincipal =
    Math.abs(amountsSum - principal) <= AMOUNT_SUM_TOLERANCE;

  const resplit = (nextPrincipal: number, nextCount: number) => {
    setInstallmentAmounts(splitEvenly(nextPrincipal, nextCount));
  };

  const handlePrincipalChange = (value: number) => {
    setPrincipalAmount(value);
    setFieldErrors((prev) => ({ ...prev, principalAmount: undefined }));
    if (!amountsManuallyEdited) {
      resplit(value, count);
    }
  };

  const handleCountChange = (value: string) => {
    setTotalInstallments(value);
    setFieldErrors((prev) => ({ ...prev, totalInstallments: undefined }));
    resplit(principal, parseInt(value, 10) || 0);
    setAmountsManuallyEdited(false);
  };

  const handleAmountChange = (index: number, value: number) => {
    setAmountsManuallyEdited(true);
    setInstallmentAmounts((prev) =>
      prev.map((amount, i) => (i === index ? value : amount)),
    );
    setFieldErrors((prev) => ({ ...prev, installmentAmounts: undefined }));
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!promissoryNoteNumber.trim()) {
      errors.promissoryNoteNumber = 'El número de pagaré es obligatorio.';
    }
    if (!(principal > 0)) {
      errors.principalAmount = 'El monto debe ser mayor a 0.';
    }
    const rate = parseFloat(interestRate);
    if (
      interestRate.trim() === '' ||
      Number.isNaN(rate) ||
      rate < 0 ||
      rate > 100
    ) {
      errors.interestRate = 'La tasa debe estar entre 0 y 100.';
    }
    if (!firstDueDate) {
      errors.firstDueDate = 'La fecha de la primera cuota es obligatoria.';
    }
    if (!(count > 0)) {
      errors.totalInstallments = 'El número de cuotas debe ser mayor a 0.';
    } else if (!amountsMatchPrincipal) {
      errors.installmentAmounts = `La suma de las cuotas (${formatCurrency(amountsSum)}) debe ser igual al monto (${formatCurrency(principal)}).`;
    }
    return errors;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);

    const disbursedAt =
      installmentFrequency === InstallmentFrequency.Monthly
        ? subtractMonthsFromDateString(firstDueDate, 1)
        : subtractDaysFromDateString(firstDueDate, 14);

    try {
      await onSubmit({
        promissoryNoteNumber,
        principalAmount: principal,
        interestRate: parseFloat(interestRate),
        disbursedAt,
        installmentFrequency,
        installmentAmounts,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setFieldErrors({
            promissoryNoteNumber: 'Ya existe un préstamo con este número.',
          });
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('No se pudo refinanciar el préstamo. Intenta de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-lg border border-border bg-surface px-8 py-7">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-white">
            Refinanciar préstamo
          </h2>
          <CloseButton onClick={onClose} />
        </div>
        <p className="mt-1 text-label text-muted">
          {oldLoanLabel} · Saldo actual:{' '}
          {formatCurrency(oldLoanOutstandingBalance)}
        </p>
        <p className="mt-2.5 text-meta text-mid">
          Este préstamo quedará como "Refinanciado" y sus cuotas pendientes se
          cancelarán. Se crea un préstamo nuevo con los términos de abajo — el
          monto no se calcula automáticamente, ingresa la cifra renegociada
          exacta.
        </p>

        <div className="mt-5 border-t border-border" />

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
          <div className="flex gap-4">
            <Field
              label="N° de pagaré (nuevo)"
              error={fieldErrors.promissoryNoteNumber}
            >
              <input
                value={promissoryNoteNumber}
                onChange={(event) => {
                  setPromissoryNoteNumber(event.target.value);
                  setFieldErrors((prev) => ({
                    ...prev,
                    promissoryNoteNumber: undefined,
                  }));
                }}
                placeholder="Ej: #1000"
                className={inputClassName(
                  Boolean(fieldErrors.promissoryNoteNumber),
                )}
              />
            </Field>
            <Field label="Tasa de interés (%)" error={fieldErrors.interestRate}>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={interestRate}
                onChange={(event) => {
                  setInterestRate(event.target.value);
                  setFieldErrors((prev) => ({
                    ...prev,
                    interestRate: undefined,
                  }));
                }}
                placeholder="Ej: 6"
                className={inputClassName(Boolean(fieldErrors.interestRate))}
              />
            </Field>
          </div>

          <div className="flex gap-4">
            <Field
              label="Monto renegociado"
              error={fieldErrors.principalAmount}
            >
              <CurrencyInput
                value={principalAmount}
                onChange={handlePrincipalChange}
                placeholder="Ej: $950.000"
                className={inputClassName(Boolean(fieldErrors.principalAmount))}
              />
            </Field>
            <Field label="N° cuotas" error={fieldErrors.totalInstallments}>
              <input
                type="number"
                min={1}
                value={totalInstallments}
                onChange={(event) => handleCountChange(event.target.value)}
                placeholder="Ej: 12"
                className={inputClassName(
                  Boolean(fieldErrors.totalInstallments),
                )}
              />
            </Field>
          </div>

          <div className="flex gap-4">
            <Field
              label="Fecha de la primera cuota"
              error={fieldErrors.firstDueDate}
            >
              <DatePicker
                value={firstDueDate}
                onChange={(next) => {
                  setFirstDueDate(next);
                  setFieldErrors((prev) => ({
                    ...prev,
                    firstDueDate: undefined,
                  }));
                }}
                className={inputClassName(Boolean(fieldErrors.firstDueDate))}
              />
            </Field>
            <Field label="Periodicidad de cuotas">
              <select
                value={installmentFrequency}
                onChange={(event) =>
                  setInstallmentFrequency(
                    event.target.value as InstallmentFrequency,
                  )
                }
                className={inputClassName(false)}
              >
                <option value={InstallmentFrequency.Monthly}>Mensual</option>
                <option value={InstallmentFrequency.Biweekly}>Quincenal</option>
              </select>
            </Field>
          </div>

          {count > 0 && (
            <Field
              label={`Desglose por cuota (${installmentAmounts.length})`}
              error={fieldErrors.installmentAmounts}
            >
              <div className="flex max-h-[160px] flex-col gap-2 overflow-y-auto rounded border border-border bg-input p-2.5">
                {installmentAmounts.map((amount, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-meta text-muted">
                      Cuota {index + 1}
                    </span>
                    <CurrencyInput
                      value={amount}
                      onChange={(next) => handleAmountChange(index, next)}
                      className="h-8 w-full rounded border border-border bg-background px-2.5 text-small text-white focus:border-subtle focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <span
                  className={`text-meta ${amountsMatchPrincipal ? 'text-muted' : 'text-red-400'}`}
                >
                  Suma: {formatCurrency(amountsSum)} /{' '}
                  {formatCurrency(principal)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAmountsManuallyEdited(false);
                    resplit(principal, count);
                  }}
                  className="text-meta text-muted hover:text-white"
                >
                  Repartir en partes iguales
                </button>
              </div>
            </Field>
          )}

          <Field label="Descripción (opcional)">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ej: Refinanciación del pagaré anterior…"
              rows={2}
              className="w-full resize-none rounded border border-border bg-input px-3.5 py-2 text-control text-white placeholder-mid focus:border-subtle focus:outline-none"
            />
          </Field>

          {formError && (
            <p className="text-small text-red-400" role="alert">
              {formError}
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
              {isSubmitting ? 'Refinanciando…' : 'Refinanciar préstamo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function inputClassName(hasError: boolean): string {
  const base =
    'h-[42px] w-full rounded border bg-input px-3.5 text-control text-white placeholder-mid focus:outline-none';
  return hasError
    ? `${base} border-red-500 focus:border-red-500`
    : `${base} border-border focus:border-subtle`;
}

interface FieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, error, children }: FieldProps) {
  return (
    <div className="flex flex-1 flex-col gap-1.5">
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
