import { useState } from 'react';

import { CloseButton } from '@/components/ui/CloseButton';
import { ModuleChecklist } from '@/features/users/ModuleChecklist';
import { ApiError } from '@/lib/apiClient';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type { AppModule } from '@/features/auth/authApi';
import type { User } from '@/features/users/usersApi';

interface UserPermissionsDialogProps {
  user: User;
  onSubmit: (modules: AppModule[]) => Promise<User>;
  onClose: () => void;
}

// Only ever opened for a collector row (see UserRow.tsx) — an admin has
// full access unconditionally, so editing their modules would do nothing.
// See docs/phasesClient/PHASE_20_MODULE_PERMISSIONS.md.
export function UserPermissionsDialog({
  user,
  onSubmit,
  onClose,
}: UserPermissionsDialogProps) {
  const [modules, setModules] = useState<AppModule[]>(user.modules);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEscapeKey(onClose);

  const handleSave = async () => {
    setFormError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(modules);
      onClose();
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : 'No se pudieron guardar los permisos. Intenta de nuevo.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-[480px] rounded-lg border border-border bg-surface px-8 py-7">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-medium text-white">
            Permisos de {user.fullName}
          </h2>
          <CloseButton onClick={onClose} />
        </div>
        <p className="mt-1 text-label text-muted">
          Módulos del panel que este usuario puede ver y usar.
        </p>

        <div className="mt-5 border-t border-border" />

        <div className="mt-5">
          <ModuleChecklist selected={modules} onChange={setModules} />
        </div>

        {formError && (
          <p className="mt-3 text-small text-red-400" role="alert">
            {formError}
          </p>
        )}

        <div className="mt-5 border-t border-border" />

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border bg-input px-4 py-2.5 text-small text-muted hover:text-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSubmitting}
            className="rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Guardando…' : 'Guardar permisos'}
          </button>
        </div>
      </div>
    </div>
  );
}
