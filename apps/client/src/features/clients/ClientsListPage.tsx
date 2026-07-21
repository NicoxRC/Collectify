import { useState } from 'react';

import { Header } from '@/components/layout/Header';
import { useAuth } from '@/features/auth/useAuth';
import { ClientForm } from '@/features/clients/ClientForm';
import { ClientRow } from '@/features/clients/ClientRow';
import { DeactivateClientDialog } from '@/features/clients/DeactivateClientDialog';
import {
  useClients,
  useCreateClient,
  useDeleteClient,
  useUpdateClient,
} from '@/features/clients/useClients';

import type { Client } from '@/features/clients/clientsApi';
import type { ReactNode } from 'react';

// Matches Figma frame 40:3 ("F-10 / Clientes — Desktop 1440"), with two
// remaining deliberate departures from the mockup — see
// apps/client/docs/DESIGN_TOKENS.md "Known design/backend gaps":
//   - "Préstamos" / "Última actividad" columns dropped: not backed by any
//     endpoint yet (arrive with Phase 4/7).
//   - "Importar Excel" button dropped: that's Phase 8 scope.
// The "Todos" tab WAS missing for the same reason (isActive was a strict
// true/false), but that turned out to be worth fixing rather than dropping
// — ClientsService.findAll/QueryClientsDto now accept isActive: 'all'.
type StatusFilter = 'all' | 'active' | 'inactive';

const STATUS_FILTER_TO_IS_ACTIVE: Record<StatusFilter, boolean | 'all'> = {
  all: 'all',
  active: true,
  inactive: false,
};

export function ClientsListPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [page, setPage] = useState(1);

  const [editingClient, setEditingClient] = useState<Client | 'new' | null>(
    null,
  );
  const [deactivatingClient, setDeactivatingClient] = useState<Client | null>(
    null,
  );

  const { data, isLoading, isError } = useClients({
    search: search || undefined,
    isActive: STATUS_FILTER_TO_IS_ACTIVE[statusFilter],
    page,
  });

  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();

  const clients = data?.items ?? [];
  const meta = data?.meta;
  // First row number on the current page — see rowNumber comment below.
  const rowNumberOffset = ((meta?.page ?? 1) - 1) * (meta?.limit ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <Header title="Clientes" subtitle="Gestión de todos los clientes" />

      <div className="border-t border-border" />

      <div className="flex h-10 items-center gap-3">
        <div className="flex h-[38px] w-[280px] items-center gap-2 rounded bg-input px-3">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre, cédula o celular…"
            className="w-full bg-transparent text-small text-white placeholder-mid focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1">
          <FilterTab
            label="Todos"
            isActive={statusFilter === 'all'}
            onClick={() => {
              setStatusFilter('all');
              setPage(1);
            }}
          />
          <FilterTab
            label="Activos"
            isActive={statusFilter === 'active'}
            onClick={() => {
              setStatusFilter('active');
              setPage(1);
            }}
          />
          <FilterTab
            label="Inactivos"
            isActive={statusFilter === 'inactive'}
            onClick={() => {
              setStatusFilter('inactive');
              setPage(1);
            }}
          />
        </div>

        <div className="flex-1" />

        {isAdmin && (
          <button
            type="button"
            onClick={() => setEditingClient('new')}
            className="rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-gray-200"
          >
            + Nuevo cliente
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded bg-surface">
        <table className="w-full">
          <thead className="bg-input">
            <tr>
              <Th className="w-12">#</Th>
              <Th>Nombre</Th>
              <Th>Cédula</Th>
              <Th>Celular</Th>
              <Th>Estado</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <EmptyRow>Cargando…</EmptyRow>}
            {isError && (
              <EmptyRow tone="error">
                No se pudo cargar la lista de clientes.
              </EmptyRow>
            )}
            {!isLoading && !isError && clients.length === 0 && (
              <EmptyRow>No se encontraron clientes.</EmptyRow>
            )}
            {clients.map((client, index) => (
              <ClientRow
                key={client.id}
                client={client}
                // Purely a display sequence, not a backend field. See F-10
                // in the requirements table.
                rowNumber={rowNumberOffset + index + 1}
                isAdmin={isAdmin}
                onEdit={() => setEditingClient(client)}
                onDeactivate={() => setDeactivatingClient(client)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.total > 0 && (
        <div className="flex h-8 items-center justify-between">
          <p className="text-label text-muted">
            Mostrando {clients.length} de {meta.total} clientes
          </p>
          <div className="flex items-center gap-1">
            <PageButton
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              ←
            </PageButton>
            {Array.from(
              { length: meta.totalPages },
              (_, index) => index + 1,
            ).map((pageNumber) => (
              <PageButton
                key={pageNumber}
                isActive={pageNumber === page}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </PageButton>
            ))}
            <PageButton
              disabled={page >= meta.totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              →
            </PageButton>
          </div>
        </div>
      )}

      {editingClient && (
        <ClientForm
          client={editingClient === 'new' ? undefined : editingClient}
          onClose={() => setEditingClient(null)}
          onSubmit={(input) =>
            editingClient === 'new'
              ? createClient.mutateAsync(input)
              : updateClient.mutateAsync({ id: editingClient.id, input })
          }
        />
      )}

      {deactivatingClient && (
        <DeactivateClientDialog
          clientName={`${deactivatingClient.firstName} ${deactivatingClient.lastName}`}
          onClose={() => setDeactivatingClient(null)}
          onConfirm={() => deleteClient.mutateAsync(deactivatingClient.id)}
        />
      )}
    </div>
  );
}

function Th({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`h-[38px] px-3.5 text-left text-section-label font-medium tracking-[0.36px] text-muted ${className}`}
    >
      {children}
    </th>
  );
}

function EmptyRow({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'error';
}) {
  return (
    <tr>
      <td
        colSpan={6}
        className={`p-6 text-center text-small ${tone === 'error' ? 'text-red-400' : 'text-muted'}`}
      >
        {children}
      </td>
    </tr>
  );
}

function FilterTab({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-3 py-[7px] text-small ${
        isActive ? 'bg-border font-medium text-white' : 'bg-input text-muted'
      }`}
    >
      {label}
    </button>
  );
}

function PageButton({
  children,
  onClick,
  isActive = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-2.5 py-1.5 text-label ${
        isActive
          ? 'bg-border font-medium text-white'
          : 'border border-border bg-input text-muted disabled:opacity-40'
      }`}
    >
      {children}
    </button>
  );
}
