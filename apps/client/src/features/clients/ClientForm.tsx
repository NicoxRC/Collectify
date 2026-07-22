import { useState } from 'react';

import { CloseButton } from '@/components/ui/CloseButton';
import { ApiError } from '@/lib/apiClient';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type { Client, CreateClientInput } from '@/features/clients/clientsApi';
import type { FormEvent } from 'react';

interface ClientFormProps {
  // Present = editing; absent = creating. Matches the two Figma modals
  // (F-11 "Nuevo cliente" / F-12 "Editar cliente"), same layout for both.
  client?: Client;
  onSubmit: (input: CreateClientInput) => Promise<unknown>;
  onClose: () => void;
}

type FieldName = 'firstName' | 'lastName' | 'documentNumber' | 'phoneNumber';
type FieldErrors = Partial<Record<FieldName, string>>;

// Mirrors apps/api's CreateClientDto: @IsPhoneNumber('CO') requires a
// Colombian number. This is a client-side approximation (the backend, via
// libphonenumber-js, is the real authority) — good enough to catch the
// obvious mistake of typing a bare local number without +57.
const CO_PHONE_REGEX = /^\+57\d{10}$/;

// Fields match apps/api's CreateClientDto exactly: firstName, lastName,
// documentNumber, phoneNumber. The Figma modals show a single "Nombre
// completo" field (no lastName) and no cédula field at all, plus a
// "Correo electrónico" and "Dirección" that don't exist on the backend at
// all — none of that is buildable against the real API, so this form
// follows the backend's fields instead of the mockup's. See
// apps/client/docs/DESIGN_TOKENS.md "Known design/backend gaps".
export function ClientForm({ client, onSubmit, onClose }: ClientFormProps) {
  const isEditing = Boolean(client);

  const [firstName, setFirstName] = useState(client?.firstName ?? '');
  const [lastName, setLastName] = useState(client?.lastName ?? '');
  const [documentNumber, setDocumentNumber] = useState(
    client?.documentNumber ?? '',
  );
  const [phoneNumber, setPhoneNumber] = useState(client?.phoneNumber ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEscapeKey(onClose);

  // Mirrors CreateClientDto's validators client-side, so obvious mistakes
  // are caught before hitting the API — required by Phase 3 scope.
  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (!firstName.trim()) {
      errors.firstName = 'El nombre es obligatorio.';
    }
    if (!lastName.trim()) {
      errors.lastName = 'El apellido es obligatorio.';
    }
    if (!documentNumber.trim()) {
      errors.documentNumber = 'La cédula es obligatoria.';
    }
    if (!phoneNumber.trim()) {
      errors.phoneNumber = 'El celular es obligatorio.';
    } else if (!CO_PHONE_REGEX.test(phoneNumber.trim())) {
      errors.phoneNumber =
        'Debe ser un número colombiano válido, ej: +573001234567.';
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

    try {
      await onSubmit({ firstName, lastName, documentNumber, phoneNumber });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        // Backend throws ConflictException("A client with document number
        // X already exists") for a duplicate cédula — surface that next to
        // the Cédula field instead of as a raw banner message, per Phase 3.
        if (err.statusCode === 409 && /document number/i.test(err.message)) {
          setFieldErrors({
            documentNumber: 'Ya existe un cliente registrado con esta cédula.',
          });
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('No se pudo guardar el cliente. Intenta de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-[480px] rounded-lg border border-border bg-surface px-8 py-7">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-white">
            {isEditing ? 'Editar cliente' : 'Nuevo cliente'}
          </h2>
          <CloseButton onClick={onClose} />
        </div>

        <p className="mt-1 text-label text-muted">
          {isEditing
            ? `Editando: ${client?.firstName} ${client?.lastName} · ID #${client?.id.slice(0, 8)}`
            : 'Solo administradores pueden crear clientes.'}
        </p>

        <div className="mt-5 border-t border-border" />

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
          <div className="flex gap-4">
            <Field label="Nombre" error={fieldErrors.firstName}>
              <input
                required
                value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  setFieldErrors((prev) => ({
                    ...prev,
                    firstName: undefined,
                  }));
                }}
                placeholder="Ej: Carlos"
                className={inputClassName(Boolean(fieldErrors.firstName))}
              />
            </Field>
            <Field label="Apellido" error={fieldErrors.lastName}>
              <input
                required
                value={lastName}
                onChange={(event) => {
                  setLastName(event.target.value);
                  setFieldErrors((prev) => ({
                    ...prev,
                    lastName: undefined,
                  }));
                }}
                placeholder="Ej: Mendoza"
                className={inputClassName(Boolean(fieldErrors.lastName))}
              />
            </Field>
          </div>

          <div className="flex gap-4">
            <Field label="Cédula" error={fieldErrors.documentNumber}>
              <input
                required
                value={documentNumber}
                onChange={(event) => {
                  setDocumentNumber(event.target.value);
                  setFieldErrors((prev) => ({
                    ...prev,
                    documentNumber: undefined,
                  }));
                }}
                placeholder="Ej: 1234567890"
                className={inputClassName(Boolean(fieldErrors.documentNumber))}
              />
            </Field>
            <Field label="Celular" error={fieldErrors.phoneNumber}>
              <input
                required
                value={phoneNumber}
                onChange={(event) => {
                  setPhoneNumber(event.target.value);
                  setFieldErrors((prev) => ({
                    ...prev,
                    phoneNumber: undefined,
                  }));
                }}
                placeholder="Ej: +573158001234"
                className={inputClassName(Boolean(fieldErrors.phoneNumber))}
              />
            </Field>
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
              disabled={isSubmitting}
              className="rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? 'Guardando…'
                : isEditing
                  ? 'Guardar cambios'
                  : 'Guardar cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Shared input styling, switching to a red border when the field has a
// validation or API error attached — keeps the error visually anchored to
// the field it belongs to, not just a generic banner.
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
