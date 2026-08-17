import { useState } from 'react';

import { CloseButton } from '@/components/ui/CloseButton';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { useClient, useClients } from '@/features/clients/useClients';
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

import type { Client, ClientDetail } from '@/features/clients/clientsApi';
import type {
  CreateLoanInput,
  LoanConceptAssignment,
  PreviewedInstallment,
} from '@/features/loans/loansApi';
import type { FormEvent } from 'react';

interface LoanFormProps {
  onSubmit: (input: CreateLoanInput) => Promise<unknown>;
  onClose: () => void;
}

// One row of the "Conceptos" repeater — a LoanConceptAssignment plus a
// client-only id (for React keys / stable row identity as rows are
// added/removed, since two rows could otherwise share the same
// conceptTypeId+value and be indistinguishable to React).
interface ConceptRow extends LoanConceptAssignment {
  rowId: string;
}

type FieldName =
  | 'clientId'
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
  return `row-${nextRowId}`;
}

// As of Phase 14 (docs/phases/PHASE_14_INTEREST_CONCEPTS.md), the API
// generates the installment schedule from principalAmount,
// totalInstallments, and concepts — this form no longer collects or splits
// installmentAmounts by hand. interestRate is kept (still required by the
// API) but now only drives moratory interest on overdue installments, not
// the cost of the loan itself — see the relabeled field below.
//
// Per-installment concept overrides (InstallmentConceptOverrideDto) are not
// exposed here — expected to be a rare case, and the API accepts the same
// baseline concepts for every installment when no override is sent. Revisit
// if the business needs it.
export function LoanForm({ onSubmit, onClose }: LoanFormProps) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const { data: clientResults } = useClients({
    search: clientSearch,
    isActive: true,
  });
  // GET /clients (search results) doesn't include creditUsed/creditAvailable/
  // isMoraBlocked — only GET /clients/:id does (computed on read, see
  // ClientsService.findOneDetail). Fetched once a client is picked, to
  // surface cupo/mora-block inline before the admin fills out the rest of
  // the form. See docs/phases/PHASE_10_CLIENT_CAPACITY.md.
  const { data: selectedClientDetail } = useClient(selectedClient?.id ?? '');
  // Drives disabling the rest of the form below — the client caught that
  // leaving everything fillable when we already know upfront it'll be
  // rejected just produces a confusing duplicate error (the inline notice
  // plus the same message again from the failed submit). See
  // docs/phases/PHASE_10_CLIENT_CAPACITY.md.
  const isMoraBlocked = Boolean(selectedClientDetail?.isMoraBlocked);

  const [promissoryNoteNumber, setPromissoryNoteNumber] = useState('');
  const [principalAmount, setPrincipalAmount] = useState(0);
  const [interestRate, setInterestRate] = useState('');
  const [firstDueDate, setFirstDueDate] = useState('');
  const [installmentFrequency, setInstallmentFrequency] = useState(
    InstallmentFrequency.Monthly,
  );
  const [totalInstallments, setTotalInstallments] = useState('');
  const [concepts, setConcepts] = useState<ConceptRow[]>([]);
  // 0-based index into the generated schedule flagged "Cuota inicial", or
  // null when none is. See docs/phases/PHASE_13_INITIAL_INSTALLMENT.md.
  const [initialInstallmentIndex, setInitialInstallmentIndex] = useState<
    number | null
  >(null);
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

  // A resize always clears the initial-installment flag — the row indices
  // no longer mean the same thing after a resize, so keeping it risks
  // flagging the wrong generated installment as the initial one. See
  // docs/phases/PHASE_13_INITIAL_INSTALLMENT.md.
  const handleCountChange = (value: string) => {
    setTotalInstallments(value);
    setFieldErrors((prev) => ({ ...prev, totalInstallments: undefined }));
    setInitialInstallmentIndex(null);
    setPreview(null);
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!selectedClient) {
      errors.clientId = 'Selecciona un cliente.';
    } else if (isMoraBlocked) {
      // Defensive fallback only — the fieldset/submit button below are
      // disabled whenever this is true, so this normally can't be reached
      // through the UI.
      errors.clientId =
        'Este cliente no puede recibir un nuevo préstamo mientras esté bloqueado por mora.';
    }
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
        clientId: selectedClient!.id,
        promissoryNoteNumber,
        principalAmount: principal,
        interestRate: parseFloat(interestRate),
        disbursedAt: computeDisbursedAt(),
        installmentFrequency,
        totalInstallments: count,
        concepts: toConceptAssignments(),
        initialInstallmentIndex: initialInstallmentIndex ?? undefined,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setFieldErrors({
            promissoryNoteNumber: 'Ya existe un préstamo con este número.',
          });
          // Phase 10 guard — LoansService.create() rejects with one of two
          // distinct English messages (see loans.service.ts's
          // assertClientCanTakeNewLoan); matched here and translated,
          // anchored to the field the admin needs to look at.
        } else if (err.statusCode === 400 && /overdue/i.test(err.message)) {
          setFieldErrors({
            clientId:
              'Este cliente tiene una cuota con más de 30 días de mora y no puede recibir un nuevo préstamo.',
          });
        } else if (err.statusCode === 400 && /cupo/i.test(err.message)) {
          setFieldErrors({
            principalAmount: 'El monto supera el cupo disponible del cliente.',
          });
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('No se pudo crear el préstamo. Intenta de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-lg border border-border bg-surface px-8 py-7">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-white">Nuevo préstamo</h2>
          <CloseButton onClick={onClose} />
        </div>
        <p className="mt-1 text-label text-muted">
          Solo administradores pueden crear préstamos.
        </p>

        <div className="mt-5 border-t border-border" />

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
          <Field label="Cliente" error={fieldErrors.clientId}>
            {selectedClient ? (
              <div className="flex items-center justify-between rounded border border-border bg-input px-3.5 py-2.5">
                <span className="text-control text-white">
                  {selectedClient.firstName} {selectedClient.lastName} · CC{' '}
                  {selectedClient.documentNumber}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClient(null);
                    setFieldErrors((prev) => ({
                      ...prev,
                      clientId: undefined,
                    }));
                  }}
                  className="text-meta text-muted hover:text-white"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  value={clientSearch}
                  onChange={(event) => setClientSearch(event.target.value)}
                  placeholder="Buscar cliente por nombre o cédula…"
                  className={inputClassName(Boolean(fieldErrors.clientId))}
                />
                {clientSearch && (clientResults?.items.length ?? 0) > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded border border-border bg-input shadow-lg">
                    {clientResults!.items.slice(0, 5).map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setSelectedClient(client);
                          setClientSearch('');
                          setFieldErrors((prev) => ({
                            ...prev,
                            clientId: undefined,
                          }));
                        }}
                        className="flex w-full flex-col items-start gap-0.5 px-3.5 py-2 text-left hover:bg-border"
                      >
                        <span className="text-control text-white">
                          {client.firstName} {client.lastName}
                        </span>
                        <span className="text-meta text-muted">
                          CC {client.documentNumber}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>

          {selectedClient && selectedClientDetail && (
            <ClientCapacityNotice clientDetail={selectedClientDetail} />
          )}

          {/* Disabled (not hidden) once the selected client is
              mora-blocked — the client asked for this after seeing the
              alternative: fill out the whole form, hit "Crear préstamo",
              and get the same rejection message a second time at the
              bottom. Nothing here is fillable until a non-blocked client
              is picked instead. */}
          <fieldset disabled={isMoraBlocked} className="contents">
            <div className="flex gap-4">
              <Field
                label="N° de pagaré"
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
                  placeholder="Ej: #743"
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
              <Field label="Monto" error={fieldErrors.principalAmount}>
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
                  placeholder="Ej: $1.500.000"
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
              <Field label="Cuota inicial (opcional)">
                <select
                  value={initialInstallmentIndex ?? ''}
                  onChange={(event) =>
                    setInitialInstallmentIndex(
                      event.target.value === ''
                        ? null
                        : Number(event.target.value),
                    )
                  }
                  className={inputClassName(false)}
                >
                  <option value="">Ninguna</option>
                  {Array.from({ length: count }, (_, index) => (
                    <option key={index} value={index}>
                      Cuota {index + 1}
                    </option>
                  ))}
                </select>
                <span className="mt-1 text-meta text-muted">
                  La cuota marcada como inicial queda exenta de mora — ver
                  docs/phases/PHASE_13_INITIAL_INSTALLMENT.md.
                </span>
              </Field>
            )}

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
                placeholder="Ej: Compra de electrodoméstico…"
                rows={2}
                // Not inputClassName(false) — that has a fixed h-[42px] meant
                // for single-line inputs, which fights with rows={2} and
                // squeezes the placeholder text with no vertical padding.
                // py-2.5 instead lets the textarea size itself naturally,
                // matching MessageTemplateForm.tsx's textarea.
                className="w-full resize-none rounded border border-border bg-input px-3.5 py-2 text-control text-white placeholder-mid focus:border-subtle focus:outline-none"
              />
            </Field>
          </fieldset>

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
              disabled={isSubmitting || isMoraBlocked}
              className="rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Creando…' : 'Crear préstamo'}
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

// Inline surfacing of the client's cupo/mora-block status once picked —
// mirrors the same rejection reasons the backend would otherwise only
// reveal after submit (see the 400-handling in handleSubmit above). Purely
// informational: the backend is still the source of truth and re-checks
// both at submit time regardless of what this shows.
function ClientCapacityNotice({
  clientDetail,
}: {
  clientDetail: ClientDetail;
}) {
  if (clientDetail.isMoraBlocked) {
    return (
      <p
        role="alert"
        className="rounded border border-[#ef4444] bg-[#240a0a] px-3.5 py-2.5 text-small text-[#ef4444]"
      >
        Este cliente tiene una cuota con más de 30 días de mora y no puede
        recibir un nuevo préstamo.
      </p>
    );
  }

  if (clientDetail.creditLimit === null) {
    return null;
  }

  return (
    <p className="text-meta text-muted">
      Cupo disponible: {formatCurrency(clientDetail.creditAvailable ?? 0)} de{' '}
      {formatCurrency(clientDetail.creditLimit)}
    </p>
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
