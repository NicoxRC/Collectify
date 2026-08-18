import { useEffect, useState } from 'react';

import { CloseButton } from '@/components/ui/CloseButton';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { FileUploadField } from '@/components/ui/FileUploadField';
import { Select } from '@/components/ui/Select';
import {
  DOCUMENT_TYPE_LABELS,
  DocumentType,
} from '@/features/clients/clientsApi';
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
import {
  usePreviewSchedule,
  useRefinanceQuote,
} from '@/features/loans/useLoans';
import { StaleUsuryRateBanner } from '@/features/usuryRates/StaleUsuryRateBanner';
import { ApiError } from '@/lib/apiClient';
import { formatCurrency, formatDateOnly } from '@/lib/format';
import { ImageUploadError, uploadDocument } from '@/lib/imageUpload';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type {
  Loan,
  LoanConceptAssignment,
  RefinanceLoanInput,
  RefinanceQuote,
  SchedulePreview,
} from '@/features/loans/loansApi';
import type { FormEvent } from 'react';

// The fields carried over from the loan being refinanced — pre-fill the
// codeudor section from these, same shape as what LoanDetailPage.tsx
// already has loaded on `loan`. See docs/phasesClient/PHASE_21_CLIENT_PROFILE.md.
type OldLoanCoDebtor = Pick<
  Loan,
  | 'coDebtorFullName'
  | 'coDebtorDocumentType'
  | 'coDebtorDocumentNumber'
  | 'coDebtorPhoneNumber'
  | 'coDebtorAddress'
  | 'coDebtorRelationship'
  | 'coDebtorIdDocumentUrl'
>;

interface RefinanceLoanFormProps {
  oldLoanId: string;
  oldLoanLabel: string;
  oldLoanOutstandingBalance: number;
  oldLoanCoDebtor: OldLoanCoDebtor;
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
  | 'concepts'
  | 'coDebtorFullName';
type FieldErrors = Partial<Record<FieldName, string>>;

const CO_DEBTOR_DOCUMENT_TYPE_OPTIONS = [
  { value: '', label: 'Sin especificar' },
  ...Object.values(DocumentType).map((type) => ({
    value: type,
    label: DOCUMENT_TYPE_LABELS[type],
  })),
];

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
//
// Phase 17 (docs/phases/PHASE_17_REFINANCING_RECALC.md) reopens Phase 6's
// "type the exact figure by hand" decision: principalAmount and concepts
// are now pre-filled from GET /loans/:id/refinance-quote, but both stay
// fully editable — the admin keeps final say, exactly as Phase 6 required.
export function RefinanceLoanForm({
  oldLoanId,
  oldLoanLabel,
  oldLoanOutstandingBalance,
  oldLoanCoDebtor,
  onSubmit,
  onClose,
}: RefinanceLoanFormProps) {
  const [promissoryNoteNumber, setPromissoryNoteNumber] = useState('');
  const [principalAmount, setPrincipalAmount] = useState(0);
  const [additionalPrincipalPayment, setAdditionalPrincipalPayment] =
    useState(0);
  const [interestRate, setInterestRate] = useState('');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [installmentFrequency, setInstallmentFrequency] = useState(
    InstallmentFrequency.Monthly,
  );
  const [totalInstallments, setTotalInstallments] = useState('');
  const [concepts, setConcepts] = useState<ConceptRow[]>([]);
  const [description, setDescription] = useState('');
  // Only meaningful when preview?.usuryWarning fired — see
  // docs/phases/PHASE_15_USURY_RATE.md ("warning, not a hard block").
  const [usuryJustification, setUsuryJustification] = useState('');

  // Phase 21 — pre-filled from the loan being refinanced (oldLoanCoDebtor)
  // but fully editable, same as the backend's own
  // `dto.field ?? oldLoan.field` carry-over in LoansService#refinance: if
  // the admin leaves these untouched, submitting sends the same values the
  // backend would've defaulted to anyway. See
  // docs/phasesClient/PHASE_21_CLIENT_PROFILE.md.
  const [hasCoDebtor, setHasCoDebtor] = useState(
    Boolean(oldLoanCoDebtor.coDebtorFullName),
  );
  const [coDebtorFullName, setCoDebtorFullName] = useState(
    oldLoanCoDebtor.coDebtorFullName ?? '',
  );
  const [coDebtorDocumentType, setCoDebtorDocumentType] = useState(
    oldLoanCoDebtor.coDebtorDocumentType ?? '',
  );
  const [coDebtorDocumentNumber, setCoDebtorDocumentNumber] = useState(
    oldLoanCoDebtor.coDebtorDocumentNumber ?? '',
  );
  const [coDebtorPhoneNumber, setCoDebtorPhoneNumber] = useState(
    oldLoanCoDebtor.coDebtorPhoneNumber ?? '',
  );
  const [coDebtorAddress, setCoDebtorAddress] = useState(
    oldLoanCoDebtor.coDebtorAddress ?? '',
  );
  const [coDebtorRelationship, setCoDebtorRelationship] = useState(
    oldLoanCoDebtor.coDebtorRelationship ?? '',
  );
  const [coDebtorIdDocumentFile, setCoDebtorIdDocumentFile] =
    useState<File | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewConceptTypeForm, setShowNewConceptTypeForm] = useState(false);
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [refinanceQuote, setRefinanceQuote] = useState<RefinanceQuote | null>(
    null,
  );

  useEscapeKey(onClose);

  const { data: conceptTypes } = useInterestConceptTypes({ isActive: true });
  const createConceptType = useCreateInterestConceptType();
  const previewSchedule = usePreviewSchedule();
  const refinanceQuoteMutation = useRefinanceQuote();

  // Pre-fills principalAmount and concepts as soon as the old loan's quote
  // is available — both remain fully editable afterward. A failed fetch
  // just leaves the form blank, same as pre-Phase-17 behavior, so this
  // never blocks refinancing.
  useEffect(() => {
    refinanceQuoteMutation
      .mutateAsync(oldLoanId)
      .then((quote) => {
        setRefinanceQuote(quote);
        setPrincipalAmount(quote.suggestedPrincipalAmount);
        setConcepts(
          quote.concepts.map((concept) => ({
            rowId: makeRowId(),
            ...concept,
          })),
        );
      })
      .catch(() => {
        // Non-fatal — see comment above.
      });
    // Fetch once, when the form opens — not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oldLoanId]);

  // Recomputes the suggested principal against the loaded quote — the
  // admin can still hand-edit the result afterward via the field itself
  // (confirmed with the human: this is client-side arithmetic only, not a
  // separate backend concept). Clamped at 0 so a paydown larger than the
  // suggested capital can't produce a negative amount.
  const handleAdditionalPrincipalPaymentChange = (value: number) => {
    setAdditionalPrincipalPayment(value);
    if (refinanceQuote) {
      setPrincipalAmount(
        Math.max(0, refinanceQuote.suggestedPrincipalAmount - value),
      );
      setFieldErrors((prev) => ({ ...prev, principalAmount: undefined }));
    }
  };

  const principal = principalAmount;
  const count = parseInt(totalInstallments, 10) || 0;
  // Confirmed with the human (2026-08-18): the client must be current on
  // the old loan before it can be refinanced — enforced server-side in
  // POST /loans/:id/refinance, surfaced here up front from the quote so
  // the admin doesn't fill out the whole form only to get rejected at
  // submit. See LoansService.blockingInstallmentNumbers.
  const blockingInstallments =
    refinanceQuote?.blockedByPendingInstallments ?? [];
  const isBlocked = blockingInstallments.length > 0;

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
    if (hasCoDebtor && !coDebtorFullName.trim()) {
      errors.coDebtorFullName =
        'El nombre del codeudor es obligatorio si se marca esta sección.';
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

    // Deferred upload, same pattern as LoanForm.tsx/ClientForm.tsx — only
    // actually sent once the rest of the form has passed validation. If
    // the admin never picks a replacement, coDebtorIdDocumentUrl stays
    // undefined here and the backend's own carry-over
    // (`dto.coDebtorIdDocumentUrl ?? oldLoan.coDebtorIdDocumentUrl`) keeps
    // the old loan's document on the new one.
    let coDebtorIdDocumentUrl: string | undefined;
    if (hasCoDebtor && coDebtorIdDocumentFile) {
      setIsUploading(true);
      try {
        coDebtorIdDocumentUrl = await uploadDocument(coDebtorIdDocumentFile);
      } catch (err) {
        setFormError(
          err instanceof ImageUploadError
            ? err.message
            : 'No se pudo subir el documento del codeudor. Intenta de nuevo.',
        );
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

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
        usuryJustification: preview?.usuryWarning
          ? usuryJustification.trim() || undefined
          : undefined,
        ...(hasCoDebtor
          ? {
              coDebtorFullName: coDebtorFullName.trim(),
              ...(coDebtorDocumentType
                ? { coDebtorDocumentType: coDebtorDocumentType as DocumentType }
                : {}),
              ...(coDebtorDocumentNumber.trim()
                ? { coDebtorDocumentNumber: coDebtorDocumentNumber.trim() }
                : {}),
              ...(coDebtorPhoneNumber.trim()
                ? { coDebtorPhoneNumber: coDebtorPhoneNumber.trim() }
                : {}),
              ...(coDebtorAddress.trim()
                ? { coDebtorAddress: coDebtorAddress.trim() }
                : {}),
              ...(coDebtorRelationship.trim()
                ? { coDebtorRelationship: coDebtorRelationship.trim() }
                : {}),
              ...(coDebtorIdDocumentUrl ? { coDebtorIdDocumentUrl } : {}),
            }
          : {}),
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setFieldErrors({
            promissoryNoteNumber: 'Ya existe un préstamo con este número.',
          });
        } else if (
          err.statusCode === 400 &&
          /cannot be refinanced until/i.test(err.message)
        ) {
          setFormError(
            'El cliente debe estar al día para poder refinanciar — paga primero las cuotas vencidas.',
          );
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
          monto renegociado viene precargado con lo que el cliente realmente
          debe hoy (capital pendiente + interés ya causado, sin cobrar interés
          futuro), pero podés editarlo libremente.
        </p>

        <div className="mt-3.5">
          <StaleUsuryRateBanner />
        </div>

        {isBlocked && (
          <p
            role="alert"
            className="mt-3.5 rounded border border-[#ef4444] bg-[#240a0a] px-3.5 py-2.5 text-small text-[#ef4444]"
          >
            Este préstamo no se puede refinanciar todavía: el cliente debe
            ponerse al día primero pagando la
            {blockingInstallments.length > 1 ? 's cuotas ' : ' cuota '}
            {blockingInstallments.join(', ')}
            {blockingInstallments.length > 1
              ? ' completas (capital + interés).'
              : ' completa (capital + interés).'}
          </p>
        )}

        <div className="mt-5 border-t border-border" />

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
          <fieldset disabled={isBlocked} className="contents">
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
                  className={inputClassName(
                    Boolean(fieldErrors.principalAmount),
                  )}
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

            {refinanceQuote && (
              <div className="rounded border border-border bg-input p-3">
                <span className="text-meta text-muted">
                  Cómo se calculó el monto sugerido
                </span>
                <div className="mt-2 flex items-center justify-between text-meta">
                  <span className="text-muted">Capital pendiente</span>
                  <span className="text-white">
                    {formatCurrency(refinanceQuote.payoff.totalPrincipalOwed)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-meta">
                  <span className="text-muted">Interés causado</span>
                  <span className="text-white">
                    {formatCurrency(refinanceQuote.payoff.totalInterestOwed)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-meta font-medium">
                  <span className="text-muted">Capital sugerido</span>
                  <span className="text-white">
                    {formatCurrency(refinanceQuote.suggestedPrincipalAmount)}
                  </span>
                </div>
              </div>
            )}

            <Field label="Abono adicional a capital (opcional)">
              <CurrencyInput
                value={additionalPrincipalPayment}
                onChange={handleAdditionalPrincipalPaymentChange}
                placeholder="Ej: $100.000"
                className={inputClassName(false)}
              />
              <span className="mt-1 text-meta text-muted">
                Se resta del monto sugerido — el campo "Monto renegociado" sigue
                siendo editable después.
              </span>
            </Field>

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
                  <option value={InstallmentFrequency.Biweekly}>
                    Quincenal
                  </option>
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
                        row.calculationType ===
                        ConceptCalculationType.Percentage
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
                          <th className="pb-1 text-right font-normal">
                            Capital
                          </th>
                          <th className="pb-1 text-right font-normal">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.installments.map((installment) => (
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
                {preview?.usuryWarning && (
                  <p className="mt-2.5 text-meta text-red-400" role="alert">
                    Este cronograma supera la tasa de usura vigente (
                    {preview.usuryWarning.maxEffectiveInstallmentRate}% vs.{' '}
                    {preview.usuryWarning.currentCeilingRate}% permitido). El
                    préstamo puede crearse igual, pero considera dejar una
                    justificación abajo.
                  </p>
                )}
              </div>
            )}

            {preview?.usuryWarning && (
              <Field label="Justificación de la tasa de usura (opcional)">
                <textarea
                  value={usuryJustification}
                  onChange={(event) =>
                    setUsuryJustification(event.target.value)
                  }
                  placeholder="Ej: Cliente antiguo, aprobado por el dueño."
                  rows={2}
                  className="w-full resize-none rounded border border-border bg-input px-3.5 py-2 text-control text-white placeholder-mid focus:border-subtle focus:outline-none"
                />
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
          </fieldset>

          {/* Phase 21 — pre-filled from the loan being refinanced, still
              editable. See docs/phasesClient/PHASE_21_CLIENT_PROFILE.md. */}
          <div className="flex flex-col gap-3.5 rounded border border-border bg-input p-3">
            <label className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={hasCoDebtor}
                onChange={(event) => {
                  setHasCoDebtor(event.target.checked);
                  setFieldErrors((prev) => ({
                    ...prev,
                    coDebtorFullName: undefined,
                  }));
                }}
                className="size-4 shrink-0 rounded border-border bg-background accent-white"
              />
              <span className="text-control text-white">
                Este préstamo tiene codeudor
              </span>
            </label>

            {hasCoDebtor && (
              <div className="flex flex-col gap-3">
                <Field
                  label="Nombre completo"
                  error={fieldErrors.coDebtorFullName}
                >
                  <input
                    value={coDebtorFullName}
                    onChange={(event) => {
                      setCoDebtorFullName(event.target.value);
                      setFieldErrors((prev) => ({
                        ...prev,
                        coDebtorFullName: undefined,
                      }));
                    }}
                    placeholder="Ej: Carlos Gómez"
                    className={inputClassName(
                      Boolean(fieldErrors.coDebtorFullName),
                    )}
                  />
                </Field>
                <div className="flex gap-4">
                  <Field label="Tipo de documento (opcional)">
                    <Select
                      value={coDebtorDocumentType}
                      onChange={setCoDebtorDocumentType}
                      options={CO_DEBTOR_DOCUMENT_TYPE_OPTIONS}
                      className="w-full"
                    />
                  </Field>
                  <Field label="N° de documento (opcional)">
                    <input
                      value={coDebtorDocumentNumber}
                      onChange={(event) =>
                        setCoDebtorDocumentNumber(event.target.value)
                      }
                      placeholder="Ej: 1122334455"
                      className={inputClassName(false)}
                    />
                  </Field>
                </div>
                <div className="flex gap-4">
                  <Field label="Teléfono (opcional)">
                    <input
                      value={coDebtorPhoneNumber}
                      onChange={(event) =>
                        setCoDebtorPhoneNumber(event.target.value)
                      }
                      placeholder="Ej: +573007778899"
                      className={inputClassName(false)}
                    />
                  </Field>
                  <Field label="Relación con el deudor (opcional)">
                    <input
                      value={coDebtorRelationship}
                      onChange={(event) =>
                        setCoDebtorRelationship(event.target.value)
                      }
                      placeholder="Ej: Hermano del deudor"
                      className={inputClassName(false)}
                    />
                  </Field>
                </div>
                <Field label="Dirección (opcional)">
                  <input
                    value={coDebtorAddress}
                    onChange={(event) => setCoDebtorAddress(event.target.value)}
                    placeholder="Ej: Cra 10 #20-30"
                    className={inputClassName(false)}
                  />
                </Field>
                <Field label="Documento de identidad (opcional)">
                  <FileUploadField
                    file={coDebtorIdDocumentFile}
                    onFileChange={setCoDebtorIdDocumentFile}
                    existingUrl={oldLoanCoDebtor.coDebtorIdDocumentUrl}
                    disabled={isSubmitting || isUploading}
                  />
                </Field>
              </div>
            )}
          </div>

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
              disabled={isSubmitting || isUploading || isBlocked}
              className="rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading
                ? 'Subiendo archivo…'
                : isSubmitting
                  ? 'Refinanciando…'
                  : 'Refinanciar préstamo'}
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
