import { USER_ROLE_LABELS } from '@/features/users/usersApi';

import type { User } from '@/features/users/usersApi';
import type { ReactNode } from 'react';

interface UserRowProps {
  user: User;
  // The logged-in admin can't deactivate their own account (enforced
  // server-side too, see UsersService.deactivate) — hiding the action for
  // that one row avoids sending a request that's guaranteed to 400.
  isOwnAccount: boolean;
  onDeactivate: () => void;
  onReactivate: () => void;
  onEditPermissions: () => void;
}

// No "Ver detalle"/"Editar" actions — unlike ClientRow.tsx, there's no
// GET /users/:id or PATCH /users/:id on the backend, only create,
// deactivate, and reactivate. See docs/phases/PHASE_19_USER_MANAGEMENT.md.
//
// "Permisos" (Phase 20) only shows for an active collector — an admin has
// full access unconditionally, so there's nothing to edit for one. See
// docs/phasesClient/PHASE_20_MODULE_PERMISSIONS.md.
export function UserRow({
  user,
  isOwnAccount,
  onDeactivate,
  onReactivate,
  onEditPermissions,
}: UserRowProps) {
  return (
    <tr className="border-t border-border">
      <Td className="font-medium text-white">{user.fullName}</Td>
      <Td>{user.email}</Td>
      <Td>{USER_ROLE_LABELS[user.role]}</Td>
      <Td>
        <span
          className={
            user.isActive
              ? 'rounded-[3px] border border-muted bg-border px-2 py-[3px] text-meta font-medium text-white'
              : 'rounded-[3px] border border-mid bg-border px-2 py-[3px] text-meta font-medium text-mid'
          }
        >
          {user.isActive ? 'Activo' : 'Inactivo'}
        </span>
      </Td>
      <Td>
        {user.isActive ? (
          <div className="flex gap-2">
            {user.role === 'collector' && (
              <RowAction onClick={onEditPermissions}>Permisos</RowAction>
            )}
            {isOwnAccount ? (
              <span className="text-meta text-mid">Tu cuenta</span>
            ) : (
              <RowAction onClick={onDeactivate} tone="subtle">
                Desactivar
              </RowAction>
            )}
          </div>
        ) : (
          <RowAction onClick={onReactivate}>Reactivar</RowAction>
        )}
      </Td>
    </tr>
  );
}

function Td({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`h-11 px-3.5 text-small text-muted ${className}`}>
      {children}
    </td>
  );
}

function RowAction({
  children,
  onClick,
  tone = 'muted',
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'muted' | 'subtle';
}) {
  const className = `rounded-[3px] border border-border bg-input px-1.75 py-1 text-meta ${
    tone === 'subtle'
      ? 'text-subtle hover:text-muted'
      : 'text-muted hover:text-white'
  }`;

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
