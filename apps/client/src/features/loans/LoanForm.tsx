import { useState } from 'react';

import { CloseButton } from '@/components/ui/CloseButton';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { useClient, useClients } from '@/features/clients/useClients';
import {
  subtractDaysFromDateString,
  subtractMonthsFromDateString,
} from '@/features/loans/dueDateMath';
import { InstallmentFrequency } from '@/features/loans/loansApi';
import { ApiError } from '@/lib/apiClient';
import { formatCurrency } from '@/lib/format';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type { Client, ClientDetail } from '@/features/clients/clientsApi';
import type { CreateLoanInput } from '@/features/loans/loansApi';
import type { FormEvent } from 'react';

interface LoanFormProps {
  onSubmit: (input: CreateLoanInput) => Promise<unknown>;
  onClose: () => void;
}

type FieldName =
  | 'clientId'
  | 'promissoryNoteNumber'
  | 'principalAmount'
  | 'interestRate'
  | 'firstDueDate'
  | 'totalInstallments'
  | 'installmentAmounts';
type FieldErrors = Partial<Record<FieldName, string>>;

const AMOUNT_SUM_TOLERANCE = 0.01;

// Splits `total` into `count` whole-peso installments as evenly as
// possible, handing the leftover pesos to the first few installments so
// the sum is always exact — matches the tolerance the backend checks
// (assertInstallmentAmountsMatchPrincipal, apps/api/src/loans/loans.service.ts).
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

// CreateLoanDto's fields: clientId, promissoryNoteNumber, principalAmount,
// interestRate, disbursedAt, installmentFrequency, installmentAmounts,
// description. The Figma modal (F-18) shows Cliente/Monto/N° cuotas/Fecha
// de inicio/Fecha de vencimiento/Periodicidad — missing promissoryNoteNumber
// and interestRate entirely (both required), and offering no way to enter
// per-installment amounts (installments can be unequal — confirmed in
// docs/DATABASE.md — so the API requires the explicit array, not just a
// count). This form adds the two missing required fields and the editable
// per-installment breakdown (auto-splits evenly by default).
//
// "Fecha de vencimiento" — asks for the FIRST INSTALLMENT'S due date, not
// disbursedAt, per the client's explicit request: the physical pagaré
// already has each installment's due date written on it, so typing the
// first one directly (instead of reverse-computing "what disbursement date
// gives that due date") matches how the admin actually works from the
// paper. `disbursedAt` — still required by POST /loans — is derived from it
// at submit time (see handleSubmit): one period earlier, using the same
// UTC-safe month/day arithmetic as the backend's own schedule generator
// (dueDateMath.ts). The API itself is unchanged; it still computes every
// installment's due date from disbursedAt + installmentFrequency exactly as
// before — only this form's input field changed.
// See apps/client/docs/DESIGN_TOKENS.md "Known design/backend gaps".
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
  const [installmentAmounts, setInstallmentAmounts] = useState<number[]>([]);
  const [amountsManuallyEdited, setAmountsManuallyEdited] = useState(false);
  // 0-based index of the row flagged "Cuota inicial", or null when none is
  // — mutually exclusive across rows. See
  // docs/phases/PHASE_13_INITIAL_INSTALLMENT.md.
  const [initialInstallmentIndex, setInitialInstallmentIndex] = useState<
    number | null
  >(null);
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

  // Re-splits automatically whenever Monto or N° cuotas change, as long as
  // the admin hasn't started manually editing individual amounts — once
  // they have, we stop overwriting their edits (see "Repartir en partes
  // iguales" below to reset).
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
    // A resize always regenerates — there's no sensible way to preserve
    // manual edits across a different number of installments.
    resplit(principal, parseInt(value, 10) || 0);
    setAmountsManuallyEdited(false);
    // The row indices no longer mean the same thing after a resize —
    // clear rather than risk flagging the wrong row as the initial one.
    setInitialInstallmentIndex(null);
  };

  const handleAmountChange = (index: number, value: number) => {
    setAmountsManuallyEdited(true);
    setInstallmentAmounts((prev) =>
      prev.map((amount, i) => (i === index ? value : amount)),
    );
    setFieldErrors((prev) => ({ ...prev, installmentAmounts: undefined }));
  };

  const handleToggleInitial = (index: number) => {
    setInitialInstallmentIndex((prev) => (prev === index ? null : index));
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

    // disbursedAt isn't collected directly anymore — see the top-of-file
    // comment. Derived here, one period before the first installment's due
    // date, using the same rule the backend uses to go the other way
    // (calculateDueDate in loans.service.ts).
    const disbursedAt =
      installmentFrequency === InstallmentFrequency.Monthly
        ? subtractMonthsFromDateString(firstDueDate, 1)
        : subtractDaysFromDateString(firstDueDate, 14);

    try {
      await onSubmit({
        clientId: selectedClient!.id,
        promissoryNoteNumber,
        principalAmount: principal,
        interestRate: parseFloat(interestRate),
        disbursedAt,
        installmentFrequency,
        installmentAmounts,
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
      <div className="max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-lg border border-border bg-surface px-8 py-7">
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
                label="Tasa de interés (%)"
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
                  onChange={handlePrincipalChange}
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
                  <option value={InstallmentFrequency.Biweekly}>
                    Quincenal
                  </option>
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
                      <label className="flex shrink-0 items-center gap-1.5 text-meta text-muted">
                        <input
                          type="checkbox"
                          checked={initialInstallmentIndex === index}
                          onChange={() => handleToggleInitial(index)}
                          className="h-3.5 w-3.5"
                        />
                        Inicial
                      </label>
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
