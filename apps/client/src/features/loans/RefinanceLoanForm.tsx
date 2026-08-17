import { useState } from 'react';

import { CloseButton } from '@/components/ui/CloseButton';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { InterestConceptTypeForm } from '@/features/interestConceptTypes/InterestConceptTypeForm';
import { ConceptCalculationType } from '@/features/interestConceptTypes/interestConceptTypesApi';
import {
  useCreateInterestConceptType,
  useInterestConceptTypes,
} from '@/features/interestConceptTypes/useInterestConceptTypes';
import {
  subtractDaysFromDateString,
  subtractMonthsFromDateString,
} from '@/features/loans/dueDateMath';
import { InstallmentFrequency } from '@/features/loans/loansApi';
import { usePreviewSchedule } from '@/features/loans/useLoans';
import { ApiError } from '@/lib/apiClient';
import { formatCurrency, formatDateOnly } from '@/lib/format';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type {
  LoanConceptAssignment,
  PreviewedInstallment,
  RefinanceLoanInput,
} from '@/features/loans/loansApi';
import type { FormEvent } from 'react';

interface RefinanceLoanFormProps {
  oldLoanLabel: string;
  // Shown as a reference only — apps/api/src/loans/dto/refinanceLoan.dto.ts
  // is explicit that principalAmount is NOT auto-calculated from this; the
  // admin types the exact renegotiated figure by hand (business decision,
  // not a formula) until docs/phases/PHASE_17_REFINANCING_RECALC.md ships.
  oldLoanOutstandingBalance: number;
  onSubmit: (input: RefinanceLoanInput) => Promise<unknown>;
  onClose: () => void;
}

interface ConceptRow extends LoanConceptAssignment {
  rowId: string;
}

type FieldName =
  | 'promissoryNoteNumber'
  | 'principalAmount'
  | 'interestRate'
  | 'firstDueDate'
  | 'totalInstallments'
  | 'concepts';
type FieldErrors = Partial<Record<FieldName, string>>;

let nextRowId = 0;
function makeRowId(): string {
  nextRowId += 1;
  return `refi-row-${nextRowId}`;
}

// Mirrors LoanForm.tsx's Phase 14 rewrite exactly (schedule generated from
// principalAmount/totalInstallments/concepts, no more hand-entered
// installmentAmounts) — this is structurally the same operation: create a
// new loan. The only real difference is there's no client selector —
// POST /loans/:id/refinance always attaches the new loan to the same
// client as the one being refinanced, enforced server-side.
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
  const [concepts, setConcepts] = useState<ConceptRow[]>([]);
  const [description, setDescription] = useState('');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewConceptTypeForm, setShowNewConceptTypeForm] = useState(false);
  const [preview, setPreview] = useState<PreviewedInstallment[] | null>(null);

  useEscapeKey(onClose);

  const { data: conceptTypes } = useInterestConceptTypes({ isActive: true });
  const createConceptType = useCreateInterestConceptType();
  const previewSchedule = usePreviewSchedule();

  const principal = principalAmount;
  const count = parseInt(totalInstallments, 10) || 0;

  const conceptTypeOptions = (conceptTypes ?? []).map((conceptType) => ({
    value: conceptType.id,
    label: conceptType.name,
  }));

  const addConceptRow = () => {
    const firstType = conceptTypes?.[0];
    setConcepts((prev) => [
      ...prev,
      {
        rowId: makeRowId(),
        conceptTypeId: firstType?.id ?? '',
        calculationType:
          firstType?.defaultCalculationType ??
          ConceptCalculationType.Percentage,
        value: firstType?.defaultValue ?? 0,
      },
    ]);
    setFieldErrors((prev) => ({ ...prev, concepts: undefined }));
  };

  const removeConceptRow = (rowId: string) => {
    setConcepts((prev) => prev.filter((row) => row.rowId !== rowId));
  };

  const updateConceptRow = (rowId: string, changes: Partial<ConceptRow>) => {
    setConcepts((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, ...changes } : row)),
    );
    setFieldErrors((prev) => ({ ...prev, concepts: undefined }));
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
    }
    if (concepts.some((row) => !row.conceptTypeId)) {
      errors.concepts = 'Selecciona un tipo para cada concepto agregado.';
    }
    return errors;
  };

  const computeDisbursedAt = (): string =>
    installmentFrequency === InstallmentFrequency.Monthly
      ? subtractMonthsFromDateString(firstDueDate, 1)
      : subtractDaysFromDateString(firstDueDate, 14);

  const toConceptAssignments = (): LoanConceptAssignment[] =>
    concepts.map(({ conceptTypeId, calculationType, value }) => ({
      conceptTypeId,
      calculationType,
      value,
    }));

  const handlePreview = async () => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setFormError(null);

    try {
      const result = await previewSchedule.mutateAsync({
        principalAmount: principal,
        disbursedAt: computeDisbursedAt(),
        installmentFrequency,
        totalInstallments: count,
        concepts: toConceptAssignments(),
      });
      setPreview(result);
    } catch {
      setFormError('No se pudo generar la previsualización. Intenta de nuevo.');
    }
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

    try {
      await onSubmit({
        promissoryNoteNumber,
        principalAmount: principal,
        interestRate: parseFloat(interestRate),
        disbursedAt: computeDisbursedAt(),
        installmentFrequency,
        totalInstallments: count,
        concepts: toConceptAssignments(),
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
      <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-lg border border-border bg-surface px-8 py-7">
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
            <Field
              label="Tasa de interés moratorio (%)"
              error={fieldErrors.interestRate}
            >
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
                onChange={(value) => {
                  setPrincipalAmount(value);
                  setFieldErrors((prev) => ({
                    ...prev,
                    principalAmount: undefined,
                  }));
                  setPreview(null);
                }}
                placeholder="Ej: $950.000"
                className={inputClassName(Boolean(fieldErrors.principalAmount))}
              />
            </Field>
            <Field label="N° cuotas" error={fieldErrors.totalInstallments}>
              <input
                type="number"
                min={1}
                value={totalInstallments}
                onChange={(event) => {
                  setTotalInstallments(event.target.value);
                  setFieldErrors((prev) => ({
                    ...prev,
                    totalInstallments: undefined,
                  }));
                  setPreview(null);
                }}
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
                  setPreview(null);
                }}
                className={inputClassName(Boolean(fieldErrors.firstDueDate))}
              />
            </Field>
            <Field label="Periodicidad de cuotas">
              <select
                value={installmentFrequency}
                onChange={(event) => {
                  setInstallmentFrequency(
                    event.target.value as InstallmentFrequency,
                  );
                  setPreview(null);
                }}
                className={inputClassName(false)}
              >
                <option value={InstallmentFrequency.Monthly}>Mensual</option>
                <option value={InstallmentFrequency.Biweekly}>Quincenal</option>
              </select>
            </Field>
          </div>

          <Field
            label="Conceptos de interés / cargos"
            error={fieldErrors.concepts}
          >
            <div className="flex flex-col gap-2">
              {concepts.length === 0 && (
                <p className="text-meta text-muted">
                  Sin conceptos — el préstamo se financiará solo con capital
                  (sin intereses ni cargos).
                </p>
              )}
              {concepts.map((row) => (
                <div key={row.rowId} className="flex items-center gap-2">
                  <Select
                    value={row.conceptTypeId}
                    onChange={(conceptTypeId) => {
                      const type = conceptTypes?.find(
                        (c) => c.id === conceptTypeId,
                      );
                      updateConceptRow(row.rowId, {
                        conceptTypeId,
                        calculationType:
                          type?.defaultCalculationType ?? row.calculationType,
                        value: type?.defaultValue ?? row.value,
                      });
                    }}
                    options={conceptTypeOptions}
                    className="flex-1"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.value}
                    onChange={(event) =>
                      updateConceptRow(row.rowId, {
                        value: parseFloat(event.target.value) || 0,
                      })
                    }
                    placeholder={
                      row.calculationType === ConceptCalculationType.Percentage
                        ? '%'
                        : '$'
                    }
                    className="h-9 w-24 rounded border border-border bg-input px-2.5 text-small text-white focus:border-subtle focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeConceptRow(row.rowId)}
                    className="text-meta text-muted hover:text-red-400"
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <div className="mt-1 flex items-center gap-4">
                <button
                  type="button"
                  onClick={addConceptRow}
                  className="text-meta text-muted hover:text-white"
                >
                  + Agregar concepto
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewConceptTypeForm(true)}
                  className="text-meta text-muted hover:text-white"
                >
                  + Crear nuevo tipo
                </button>
              </div>
            </div>
          </Field>

          {count > 0 && (
            <div className="rounded border border-border bg-input p-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={previewSchedule.isPending}
                  className="text-meta font-medium text-white hover:text-mid"
                >
                  {previewSchedule.isPending
                    ? 'Calculando…'
                    : 'Previsualizar cronograma de cuotas'}
                </button>
              </div>
              {preview && (
                <div className="mt-2.5 max-h-[180px] overflow-y-auto">
                  <table className="w-full text-meta">
                    <thead>
                      <tr className="text-muted">
                        <th className="pb-1 text-left font-normal">Cuota</th>
                        <th className="pb-1 text-left font-normal">Vence</th>
                        <th className="pb-1 text-right font-normal">Capital</th>
                        <th className="pb-1 text-right font-normal">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((installment) => (
                        <tr
                          key={installment.installmentNumber}
                          className="text-white"
                        >
                          <td className="py-0.5">
                            {installment.installmentNumber}
                          </td>
                          <td className="py-0.5">
                            {formatDateOnly(installment.dueDate)}
                          </td>
                          <td className="py-0.5 text-right">
                            {formatCurrency(installment.principalPortion)}
                          </td>
                          <td className="py-0.5 text-right font-medium">
                            {formatCurrency(installment.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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

      {showNewConceptTypeForm && (
        <InterestConceptTypeForm
          onSubmit={async (input) => {
            const created = await createConceptType.mutateAsync(input);
            setConcepts((prev) => [
              ...prev,
              {
                rowId: makeRowId(),
                conceptTypeId: created.id,
                calculationType: created.defaultCalculationType,
                value: created.defaultValue ?? 0,
              },
            ]);
          }}
          onClose={() => setShowNewConceptTypeForm(false)}
        />
      )}
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
