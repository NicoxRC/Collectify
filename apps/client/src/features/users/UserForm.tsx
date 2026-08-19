import { useState } from 'react';

import { CloseButton } from '@/components/ui/CloseButton';
import { Select } from '@/components/ui/Select';
import { USER_ROLE_LABELS } from '@/features/users/usersApi';
import { ApiError } from '@/lib/apiClient';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type { UserRole } from '@/features/auth/authApi';
import type { CreateUserInput, User } from '@/features/users/usersApi';
import type { FormEvent } from 'react';

interface UserFormProps {
  onSubmit: (input: CreateUserInput) => Promise<User>;
  onClose: () => void;
}

type FieldName = 'fullName' | 'email' | 'password';
type FieldErrors = Partial<Record<FieldName, string>>;

const ROLE_OPTIONS = (
  Object.entries(USER_ROLE_LABELS) as [UserRole, string][]
).map(([value, label]) => ({ value, label }));

// Create-only — no self-registration (confirmed Phase 8, see
// UsersService.create) and no edit endpoint on the backend at all, unlike
// ClientForm.tsx which doubles as both create and edit. Mirrors
// ClientForm.tsx's modal structure and field-error pattern regardless.
export function UserForm({ onSubmit, onClose }: UserFormProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('collector');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEscapeKey(onClose);

  // Mirrors CreateUserDto's validators client-side, same rationale as
  // ClientForm.tsx's validate().
  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (!fullName.trim()) {
      errors.fullName = 'El nombre es obligatorio.';
    }
    if (!email.trim()) {
      errors.email = 'El correo es obligatorio.';
    }
    if (password.length < 8) {
      errors.password = 'La contraseña debe tener al menos 8 caracteres.';
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
      await onSubmit({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
      });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        // Backend throws ConflictException("A user with email X already
        // exists") for a duplicate email — surface next to the field
        // instead of as a raw banner, same pattern as ClientForm.tsx's
        // documentNumber handling.
        if (err.statusCode === 409) {
          setFieldErrors({
            email: 'Ya existe un usuario registrado con este correo.',
          });
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('No se pudo crear el usuario. Intenta de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-[440px] rounded-lg border border-border bg-surface px-8 py-7">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-white">Nuevo usuario</h2>
          <CloseButton onClick={onClose} />
        </div>

        <p className="mt-1 text-label text-muted">
          Solo administradores pueden crear cuentas — no hay autorregistro.
        </p>

        <div className="mt-5 border-t border-border" />

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-3.5">
          <Field label="Nombre completo" error={fieldErrors.fullName}>
            <input
              required
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
                setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
              }}
              placeholder="Ej: Ana Torres"
              className={inputClassName(Boolean(fieldErrors.fullName))}
            />
          </Field>

          <Field label="Correo electrónico" error={fieldErrors.email}>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              placeholder="Ej: ana.torres@collectify.com"
              className={inputClassName(Boolean(fieldErrors.email))}
            />
          </Field>

          <Field label="Contraseña" error={fieldErrors.password}>
            <input
              required
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="Mínimo 8 caracteres"
              className={inputClassName(Boolean(fieldErrors.password))}
            />
          </Field>

          <Field label="Rol">
            <Select
              value={role}
              onChange={(value) => setRole(value as UserRole)}
              options={ROLE_OPTIONS}
              className="w-full"
            />
          </Field>

          {formError && (
            <p className="text-small text-red-400" role="alert">
              {formError}
            </p>
          )}

          <div className="mt-1.5 border-t border-border" />

          <div className="flex items-center justify-end gap-3">
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
              {isSubmitting ? 'Guardando…' : 'Guardar usuario'}
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
    <div className="flex flex-col gap-1.5">
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
