import { useState } from 'react';

import { CloseButton } from '@/components/ui/CloseButton';
import { Select } from '@/components/ui/Select';
import { ConceptCalculationType } from '@/features/interestConceptTypes/interestConceptTypesApi';
import { ApiError } from '@/lib/apiClient';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type {
  CreateInterestConceptTypeInput,
  InterestConceptType,
} from '@/features/interestConceptTypes/interestConceptTypesApi';
import type { FormEvent } from 'react';

interface InterestConceptTypeFormProps {
  // Present = editing; absent = creating — same convention as ClientForm.tsx.
  conceptType?: InterestConceptType;
  onSubmit: (input: CreateInterestConceptTypeInput) => Promise<unknown>;
  onClose: () => void;
}

type FieldName = 'name';
type FieldErrors = Partial<Record<FieldName, string>>;

const CALCULATION_TYPE_OPTIONS = [
  { value: ConceptCalculationType.Percentage, label: 'Porcentaje (%)' },
  { value: ConceptCalculationType.FixedAmount, label: 'Monto fijo ($)' },
];

// Confirmed with the human: the admin must be able to create new concept
// types at any time, not pick from a fixed list — this form is what makes
// that possible. defaultValue is a plain number field, not CurrencyInput
// (which hardcodes a "$" prefix and whole-peso formatting) — a percentage
// concept's value (e.g. 2.5) isn't a peso amount.
export function InterestConceptTypeForm({
  conceptType,
  onSubmit,
  onClose,
}: InterestConceptTypeFormProps) {
  const isEditing = Boolean(conceptType);

  const [name, setName] = useState(conceptType?.name ?? '');
  const [calculationType, setCalculationType] = useState(
    conceptType?.defaultCalculationType ?? ConceptCalculationType.Percentage,
  );
  const [defaultValue, setDefaultValue] = useState(
    conceptType?.defaultValue != null ? String(conceptType.defaultValue) : '',
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEscapeKey(onClose);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!name.trim()) {
      errors.name = 'El nombre es obligatorio.';
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

    const parsedDefaultValue = parseFloat(defaultValue);

    try {
      await onSubmit({
        name: name.trim(),
        defaultCalculationType: calculationType,
        defaultValue: Number.isFinite(parsedDefaultValue)
          ? parsedDefaultValue
          : undefined,
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError('No se pudo guardar el concepto. Intenta de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-lg border border-border bg-surface px-8 py-7">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-white">
            {isEditing ? 'Editar concepto' : 'Nuevo concepto de interés'}
          </h2>
          <CloseButton onClick={onClose} />
        </div>
        <p className="mt-1 text-label text-muted">
          Los préstamos que ya usan este concepto conservan su propio valor,
          aunque lo edites o lo desactives aquí.
        </p>

        <div className="mt-5 border-t border-border" />

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
          <Field label="Nombre" error={fieldErrors.name}>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setFieldErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="Ej: Gastos de cobranza"
              className={inputClassName(Boolean(fieldErrors.name))}
            />
          </Field>

          <Field label="Tipo de cálculo">
            <Select
              value={calculationType}
              onChange={(value) =>
                setCalculationType(value as ConceptCalculationType)
              }
              options={CALCULATION_TYPE_OPTIONS}
            />
          </Field>

          <Field label="Valor por defecto (opcional)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={defaultValue}
              onChange={(event) => setDefaultValue(event.target.value)}
              placeholder={
                calculationType === ConceptCalculationType.Percentage
                  ? 'Ej: 2 (equivale a 2%)'
                  : 'Ej: 5000'
              }
              className={inputClassName(false)}
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
              {isSubmitting
                ? 'Guardando…'
                : isEditing
                  ? 'Guardar cambios'
                  : 'Crear concepto'}
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
