import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/features/auth/useAuth';
import { ClientForm } from '@/features/clients/ClientForm';
import { DeactivateClientDialog } from '@/features/clients/DeactivateClientDialog';
import {
  useClient,
  useDeleteClient,
  useUpdateClient,
} from '@/features/clients/useClients';
import { formatPhoneNumber } from '@/lib/format';

// Matches Figma frame 40:554 ("F-14 / Detalle cliente"), minus the loan
// stats grid and loans table — neither is backed by any endpoint yet
// (arrives with Phase 4). Per docs/phasesClient/PHASE_3_CLIENTS.md this
// page covers "the client's own fields for now."
export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [isEditing, setIsEditing] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const { data: client, isLoading, isError } = useClient(id ?? '');
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  if (!id) {
    return <Navigate to="/clientes" replace />;
  }

  if (isLoading) {
    return <p className="text-small text-muted">Cargando…</p>;
  }

  if (isError || !client) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-small text-red-400">
          {
            'No se pudo cargar este cliente. Puede que no exista o esté desactivado (los clientes inactivos no tienen página de detalle — ver "Known design/backend gaps" en apps/client/docs/DESIGN_TOKENS.md).'
          }
        </p>
        <Link to="/clientes" className="text-small text-muted hover:text-white">
          ← Volver a Clientes
        </Link>
      </div>
    );
  }

  const initials =
    `${client.firstName[0] ?? ''}${client.lastName[0] ?? ''}`.toUpperCase();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-1.5 text-label">
        <Link to="/clientes" className="text-muted hover:text-white">
          Clientes
        </Link>
        <span className="text-mid">/</span>
        <span className="font-medium text-white">
          {client.firstName} {client.lastName}
        </span>
      </div>

      <div className="flex items-center justify-between rounded border border-border bg-surface px-6 py-5">
        <div className="flex items-center gap-5">
          <div className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-border">
            <span className="text-[16px] font-medium text-muted">
              {initials}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[18px] font-light text-white">
              {client.firstName} {client.lastName}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-small text-muted">
                {formatPhoneNumber(client.phoneNumber)}
              </span>
              <span className="text-meta text-mid">·</span>
              <span className="text-small text-muted">
                CC {client.documentNumber}
              </span>
              <span className="rounded-[3px] border border-muted bg-border px-2 py-[3px] text-meta font-medium text-white">
                Activo
              </span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded border border-border bg-input px-4 py-2.5 text-small text-muted hover:text-white"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={() => setIsDeactivating(true)}
              className="rounded border border-border bg-input px-4 py-2.5 text-small text-subtle hover:text-muted"
            >
              Desactivar
            </button>
          </div>
        )}
      </div>

      <div className="rounded border border-border bg-surface p-6 text-small text-muted">
        Los préstamos de este cliente se mostrarán aquí a partir de la Fase 4.
      </div>

      {isEditing && (
        <ClientForm
          client={client}
          onClose={() => setIsEditing(false)}
          onSubmit={(input) =>
            updateClient.mutateAsync({ id: client.id, input })
          }
        />
      )}

      {isDeactivating && (
        <DeactivateClientDialog
          clientName={`${client.firstName} ${client.lastName}`}
          onClose={() => setIsDeactivating(false)}
          onConfirm={async () => {
            await deleteClient.mutateAsync(client.id);
            navigate('/clientes', { replace: true });
          }}
        />
      )}
    </div>
  );
}
