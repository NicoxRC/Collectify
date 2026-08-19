import { useState } from 'react';

import { CloseButton } from '@/components/ui/CloseButton';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { FileUploadField } from '@/components/ui/FileUploadField';
import { Select } from '@/components/ui/Select';
import {
  DOCUMENT_TYPE_LABELS,
  DocumentType,
} from '@/features/clients/clientsApi';
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
import { StaleUsuryRateBanner } from '@/features/usuryRates/StaleUsuryRateBanner';
import { ApiError } from '@/lib/apiClient';
import { formatCurrency, formatDateOnly } from '@/lib/format';
import { ImageUploadError, uploadDocument } from '@/lib/imageUpload';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type { Client, ClientDetail } from '@/features/clients/clientsApi';
import type {
  CreateLoanInput,
  LoanConceptAssignment,
  SchedulePreview,
} from '@/features/loans/loansApi';
import type { FormEvent } from 'react';

interface LoanFormProps {
  onSubmit: (input: CreateLoanInput) => Promise<unknown>;
  onClose: () => void;
}

// One row of the "Cargos adicionales" repeater — a LoanConceptAssignment
// plus a client-only id (for React keys / stable row identity as rows are
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
  return `row-${nextRowId}`;
}

// As of Phase 14 (docs/phases/PHASE_14_INTEREST_CONCEPTS.md), the API
// generates the installment schedule from principalAmount,
// totalInstallments, and concepts — this form no longer collects or splits
// installmentAmounts by hand. interestRate is kept (still required by the
// API) but now only drives moratory interest on overdue installments, not
// the cost of the loan itself — see the relabeled field below. Concepts
// apply to every installment for the whole term of the loan and cannot
// vary per installment — set once here, at creation.
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
  // The "cuota inicial" — a down payment the client already made outside
  // the credit system, purely informational and unrelated to the
  // generated schedule. See docs/phases/PHASE_13_INITIAL_INSTALLMENT.md.
  const [initialPayment, setInitialPayment] = useState(0);
  const [description, setDescription] = useState('');
  // Only meaningful when preview?.usuryWarning fired — see
  // docs/phases/PHASE_15_USURY_RATE.md ("warning, not a hard block").
  const [usuryJustification, setUsuryJustification] = useState('');

  // Phase 21 — optional codeudor, off by default so the common
  // no-codeudor case doesn't add clutter; checking it reveals the fields
  // below. See docs/phasesClient/PHASE_21_CLIENT_PROFILE.md.
  const [hasCoDebtor, setHasCoDebtor] = useState(false);
  const [coDebtorFullName, setCoDebtorFullName] = useState('');
  const [coDebtorDocumentType, setCoDebtorDocumentType] = useState('');
  const [coDebtorDocumentNumber, setCoDebtorDocumentNumber] = useState('');
  const [coDebtorPhoneNumber, setCoDebtorPhoneNumber] = useState('');
  const [coDebtorAddress, setCoDebtorAddress] = useState('');
  const [coDebtorRelationship, setCoDebtorRelationship] = useState('');
  const [coDebtorIdDocumentFile, setCoDebtorIdDocumentFile] =
    useState<File | null>(null);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewConceptTypeForm, setShowNewConceptTypeForm] = useState(false);
  const [preview, setPreview] = useState<SchedulePreview | null>(null);

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

  const handleCountChange = (value: string) => {
    setTotalInstallments(value);
    setFieldErrors((prev) => ({ ...prev, totalInstallments: undefined }));
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
      errors.concepts =
        'Selecciona un tipo para cada cargo adicional agregado.';
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

    // Deferred upload, same pattern as ClientForm.tsx/
    // RegisterPaymentDialog.tsx — the file is only actually sent once the
    // rest of the form has already passed validation.
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
        clientId: selectedClient!.id,
        promissoryNoteNumber,
        principalAmount: principal,
        interestRate: parseFloat(interestRate),
        disbursedAt: computeDisbursedAt(),
        installmentFrequency,
        totalInstallments: count,
        concepts: toConceptAssignments(),
        initialPayment: initialPayment > 0 ? initialPayment : undefined,
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

        <div className="mt-3.5">
          <StaleUsuryRateBanner />
        </div>

        <div className="mt-5 border-t border-border" />

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-6">
          <FormSection title="Cliente">
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
          </FormSection>

          {/* Disabled (not hidden) once the selected client is
              mora-blocked — the client asked for this after seeing the
              alternative: fill out the whole form, hit "Crear préstamo",
              and get the same rejection message a second time at the
              bottom. Nothing here is fillable until a non-blocked client
              is picked instead. */}
          <fieldset disabled={isMoraBlocked} className="contents">
            <FormSection title="Datos del crédito">
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
                    className={inputClassName(
                      Boolean(fieldErrors.interestRate),
                    )}
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
                    className={inputClassName(
                      Boolean(fieldErrors.firstDueDate),
                    )}
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
                    <option value={InstallmentFrequency.Monthly}>
                      Mensual
                    </option>
                    <option value={InstallmentFrequency.Biweekly}>
                      Quincenal
                    </option>
                  </select>
                </Field>
              </div>
            </FormSection>

            <FormSection title="Cargos adicionales y cronograma">
              <Field label="Cargos adicionales" error={fieldErrors.concepts}>
                <div className="flex flex-col gap-2">
                  {concepts.length === 0 && (
                    <p className="text-meta text-muted">
                      Sin cargos adicionales — el préstamo se financiará solo
                      con capital. La tasa moratoria de arriba es aparte y solo
                      aplica si una cuota queda vencida.
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
                              type?.defaultCalculationType ??
                              row.calculationType,
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
                    <ChipButton onClick={addConceptRow}>
                      <PlusIcon />
                      Agregar cargo
                    </ChipButton>
                    <ChipButton onClick={() => setShowNewConceptTypeForm(true)}>
                      <PlusIcon />
                      Crear nuevo tipo
                    </ChipButton>
                  </div>
                </div>
              </Field>

              {count > 0 && (
                <div className="rounded border border-border bg-input p-3">
                  <div className="flex items-center justify-between">
                    <ChipButton
                      onClick={handlePreview}
                      disabled={previewSchedule.isPending}
                    >
                      {previewSchedule.isPending
                        ? 'Calculando…'
                        : 'Previsualizar cronograma de cuotas'}
                    </ChipButton>
                  </div>
                  {preview && (
                    <div className="mt-2.5 max-h-[180px] overflow-y-auto">
                      <table className="w-full text-meta">
                        <thead>
                          <tr className="text-muted">
                            <th className="pb-1 text-left font-normal">
                              Cuota
                            </th>
                            <th className="pb-1 text-left font-normal">
                              Vence
                            </th>
                            <th className="pb-1 text-right font-normal">
                              Capital
                            </th>
                            <th className="pb-1 text-right font-normal">
                              Total
                            </th>
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
            </FormSection>

            <FormSection title="Detalles adicionales">
              <Field label="Cuota inicial (opcional)">
                <CurrencyInput
                  value={initialPayment}
                  onChange={setInitialPayment}
                  placeholder="Ej: $200.000"
                  className={inputClassName(false)}
                />
                <span className="mt-1 text-meta text-muted">
                  Valor que el cliente ya pagó por fuera del crédito para cubrir
                  parte de la compra — es solo informativo, no hace parte de las
                  cuotas ni afecta el cronograma.
                </span>
              </Field>

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
            </FormSection>

            {/* Phase 21 — optional, off by default. See
                docs/phasesClient/PHASE_21_CLIENT_PROFILE.md. */}
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
                      onChange={(event) =>
                        setCoDebtorAddress(event.target.value)
                      }
                      placeholder="Ej: Cra 10 #20-30"
                      className={inputClassName(false)}
                    />
                  </Field>
                  <Field label="Documento de identidad (opcional)">
                    <FileUploadField
                      file={coDebtorIdDocumentFile}
                      onFileChange={setCoDebtorIdDocumentFile}
                      disabled={isSubmitting || isUploading}
                    />
                  </Field>
                </div>
              )}
            </div>
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
              disabled={isSubmitting || isUploading || isMoraBlocked}
              className="rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading
                ? 'Subiendo archivo…'
                : isSubmitting
                  ? 'Creando…'
                  : 'Crear préstamo'}
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

// Mirrors ClientForm.tsx's FormSection exactly — same fix, same reason:
// the client reported this form's field labels (10px, muted) all read as
// one undifferentiated wall of text with no way to tell where one group of
// fields ends and the next begins. A bold, larger, underlined header per
// group (reusing the same `text-label` token ClientDetailPage.tsx's
// "PRÉSTAMOS"/"HISTORIAL DE MENSAJES" headers use) gives each an actual
// title.
function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <span className="border-b border-border pb-1.5 text-label font-semibold tracking-[0.36px] text-white">
        {title.toUpperCase()}
      </span>
      {children}
    </div>
  );
}

// Same chip treatment ClientForm.tsx's "+ Agregar referencia" fix
// introduced — a bordered, backgrounded button instead of bare colored
// text sitting right next to plain muted body copy, which made it easy to
// miss as an actual clickable action.
function ChipButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 self-start rounded border border-border bg-input px-3.5 py-2 text-small text-muted hover:border-subtle hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg
      className="size-3.5 shrink-0"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
    >
      <path d="M10 4v12M4 10h12" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}
