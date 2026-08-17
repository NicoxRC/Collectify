import { Link } from 'react-router-dom';

import { formatPhoneNumber } from '@/lib/format';

import type { Client } from '@/features/clients/clientsApi';
import type { ReactNode } from 'react';

interface ClientRowProps {
  client: Client;
  // Row number for the "#" column (F-10). Purely a display sequence
  // computed from the current page/limit — not persisted or backed by any
  // field on the entity.
  rowNumber: number;
  isAdmin: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}

// Active clients can be viewed/edited; inactive (soft-deleted) ones can't:
// apps/api's ClientsService.findOne() excludes soft-deleted rows (no
// `withDeleted`), so GET/PATCH /clients/:id 404 for them — only the list
// endpoint shows them at all, via `isActive=false`. An inactive row's only
// action is "Reactivar" (PATCH /clients/:id/reactivate, admin only — see
// docs/phases/PHASE_10_CLIENT_CAPACITY.md), which restores it to active.
export function ClientRow({
  client,
  rowNumber,
  isAdmin,
  onEdit,
  onDeactivate,
  onReactivate,
}: ClientRowProps) {
  const isActive = client.deletedAt === null;

  return (
    <tr className="border-t border-border">
      <Td muted>{rowNumber}</Td>
      <Td className="font-medium text-white">
        {client.firstName} {client.lastName}
      </Td>
      <Td>{client.documentNumber}</Td>
      <Td>{formatPhoneNumber(client.phoneNumber)}</Td>
      <Td>
        <span
          className={
            isActive
              ? 'rounded-[3px] border border-muted bg-border px-2 py-[3px] text-meta font-medium text-white'
              : 'rounded-[3px] border border-mid bg-border px-2 py-[3px] text-meta font-medium text-mid'
          }
        >
          {isActive ? 'Activo' : 'Inactivo'}
        </span>
      </Td>
      <Td>
        {isActive ? (
          <div className="flex gap-2">
            <RowAction to={`/clientes/${client.id}`}>Ver detalle</RowAction>
            {isAdmin && <RowAction onClick={onEdit}>Editar</RowAction>}
            {isAdmin && (
              <RowAction onClick={onDeactivate} tone="subtle">
                Desactivar
              </RowAction>
            )}
          </div>
        ) : isAdmin ? (
          <RowAction onClick={onReactivate}>Reactivar</RowAction>
        ) : (
          <span className="text-meta text-mid">Sin acciones disponibles</span>
        )}
      </Td>
    </tr>
  );
}

function Td({
  children,
  className = '',
  muted = false,
}: {
  children: ReactNode;
  className?: string;
  // The "#" column is the one exception to the white/bold rule below —
  // using a boolean instead of letting a className override the default
  // avoids depending on Tailwind's utility ordering to "win".
  muted?: boolean;
}) {
  return (
    <td
      className={
        muted
          ? `h-11 px-3.5 text-small text-muted ${className}`
          : `h-11 px-3.5 text-small font-medium text-white ${className}`
      }
    >
      {children}
    </td>
  );
}

function RowAction({
  children,
  onClick,
  to,
  tone = 'muted',
}: {
  children: ReactNode;
  onClick?: () => void;
  to?: string;
  tone?: 'muted' | 'subtle';
}) {
  const className = `rounded-[3px] border border-border bg-input px-1.75 py-1 text-meta ${
    tone === 'subtle'
      ? 'text-subtle hover:text-muted'
      : 'text-muted hover:text-white'
  }`;

  if (to) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
