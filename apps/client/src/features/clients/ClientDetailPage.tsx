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
import {
  estadoBadge,
  moraBadgeClasses,
} from '@/features/loans/loanStatusDisplay';
import { useLoans } from '@/features/loans/useLoans';
import { useMessageLogs } from '@/features/messageLogs/useMessageLogs';
import { MESSAGE_TYPE_LABELS } from '@/features/messageTemplates/messageTemplatesApi';
import {
  useSendAccountSummary,
  useSendReminder,
  useSendUpcomingDueReminder,
} from '@/features/whatsapp/useWhatsapp';
import { ApiError } from '@/lib/apiClient';
import {
  formatCurrency,
  formatDateOnly,
  formatPhoneNumber,
} from '@/lib/format';

import type { ReactNode } from 'react';

// Matches Figma frame 40:554 ("F-14 / Detalle cliente"). The loans section
// was left as a placeholder when Phase 4 shipped — the loans feature
// (loansApi, useLoans, LoansListPage/LoanDetailPage) was built everywhere
// else, but nobody came back to wire it up here. GET /loans already
// accepts a clientId filter, so this only needed frontend work, no backend
// change. Reuses LoanRow.tsx's exact column/badge treatment (loanStatusDisplay.ts),
// minus the "Cliente" column (redundant — we're already on their page) and
// minus the "#" row-number column.
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
  // limit: 100 (not the table's display size — see displayedLoans below) so
  // the stats grid's sums are computed from this client's actual loans, not
  // just the first page. Fine for this business's real scale; if a client
  // ever has more than 100 loans the sums would undercount, same caveat as
  // the "Ver todos" link below.
  const {
    data: loans,
    isLoading: loansLoading,
    isError: loansError,
  } = useLoans({ clientId: id, limit: 100 });
  const { data: messages } = useMessageLogs({ clientId: id, limit: 5 });
  const sendReminder = useSendReminder();
  const sendUpcomingDueReminder = useSendUpcomingDueReminder();
  const sendAccountSummary = useSendAccountSummary();
  const [sendError, setSendError] = useState<string | null>(null);

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

  // Stats grid — computed client-side from data this page already fetches
  // (loans + messages), rather than waiting on a dedicated dashboard
  // aggregate endpoint (Phase 7). Only the top 10 loans are shown in the
  // table below; these sums use the full fetched set (see the limit: 100
  // comment above).
  const allLoans = loans?.items ?? [];
  const displayedLoans = allLoans.slice(0, 10);
  const totalLoans = loans?.meta.total ?? 0;
  const totalPrincipal = allLoans.reduce(
    (sum, loan) => sum + loan.principalAmount,
    0,
  );
  // overdueBalance (not outstandingBalance) — only the amount that's
  // actually overdue, not the loan's whole remaining balance. Caught by
  // the client: a loan with several pending installments and only one
  // overdue was showing the sum of all of them here.
  const totalOverdueBalance = allLoans.reduce(
    (sum, loan) => sum + loan.overdueBalance,
    0,
  );
  const totalMessages = messages?.meta.total ?? 0;

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
              {client.isMoraBlocked && (
                <span
                  title="Este cliente tiene una cuota con más de 30 días de mora y no puede recibir un nuevo préstamo."
                  className="rounded-[3px] border border-[#ef4444] bg-[#240a0a] px-2 py-[3px] text-meta font-medium text-[#ef4444]"
                >
                  Bloqueado por mora
                </span>
              )}
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
              className="rounded border border-border bg-input px-4 py-2.5 text-small text-muted hover:text-white"
            >
              Desactivar
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-5 gap-4">
        <StatCard label="Préstamos totales" value={String(totalLoans)} />
        <StatCard
          label="Monto prestado"
          value={formatCurrency(totalPrincipal)}
        />
        <StatCard label="En mora" value={formatCurrency(totalOverdueBalance)} />
        <StatCard label="Mensajes enviados" value={String(totalMessages)} />
        {/* Computed on read by the backend (ClientsService.getCreditUsage),
            not stored — see docs/phases/PHASE_10_CLIENT_CAPACITY.md. Shows
            "Sin límite" instead of a dollar figure when the client has no
            cupo configured (creditLimit null), matching how the backend
            represents "no cupo enforced". */}
        <StatCard
          label="Cupo disponible"
          value={
            client.creditLimit === null
              ? 'Sin límite'
              : formatCurrency(client.creditAvailable ?? 0)
          }
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-section-label font-medium tracking-[0.36px] text-muted">
            PRÉSTAMOS
          </span>
          {loans && loans.meta.total > displayedLoans.length && (
            // Plain link, not pre-filtered — LoansListPage's search box
            // doesn't read from the URL, so a ?search= param here would do
            // nothing. Just tells the admin there's more and where to look.
            <Link
              to="/prestamos"
              className="text-meta text-muted hover:text-white"
            >
              Ver los {loans.meta.total} en Préstamos
            </Link>
          )}
        </div>

        <div className="overflow-hidden rounded bg-surface">
          {loansLoading && (
            <p className="p-4 text-small text-muted">Cargando préstamos…</p>
          )}
          {loansError && (
            <p className="p-4 text-small text-red-400" role="alert">
              No se pudieron cargar los préstamos de este cliente.
            </p>
          )}
          {!loansLoading && !loansError && displayedLoans.length === 0 && (
            <p className="p-4 text-small text-muted">
              Este cliente todavía no tiene préstamos registrados.
            </p>
          )}
          {!loansLoading && !loansError && displayedLoans.length > 0 && (
            <table className="w-full">
              <thead className="bg-input">
                <tr>
                  <Th className="w-12">#</Th>
                  <Th>ID</Th>
                  <Th>Monto</Th>
                  <Th>Saldo</Th>
                  <Th>Cuotas</Th>
                  <Th>Estado</Th>
                  <Th>Días mora</Th>
                  <Th>Próxima cuota</Th>
                  <Th>Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {displayedLoans.map((loan, index) => {
                  const estado = estadoBadge(loan);
                  return (
                    <tr key={loan.id} className="border-t border-border">
                      <td className="h-11 px-3.5 text-small text-muted">
                        {index + 1}
                      </td>
                      <td className="h-11 px-3.5 text-small font-medium text-white">
                        {loan.promissoryNoteNumber}
                      </td>
                      <td className="h-11 px-3.5 text-small font-medium text-white">
                        {formatCurrency(loan.principalAmount)}
                      </td>
                      <td className="h-11 px-3.5 text-small font-medium text-white">
                        {formatCurrency(loan.outstandingBalance)}
                      </td>
                      <td className="h-11 px-3.5 text-small font-medium text-white">
                        {loan.installmentsPaid}/{loan.totalInstallments}
                      </td>
                      <td className="h-11 px-3.5">
                        <span
                          className={`rounded-[3px] border px-2 py-[3px] text-meta font-medium ${estado.classes}`}
                        >
                          {estado.label}
                        </span>
                      </td>
                      <td className="h-11 px-3.5">
                        <span
                          className={`rounded-[3px] border px-2 py-[3px] text-meta font-medium ${moraBadgeClasses(loan.overdueDays)}`}
                        >
                          {loan.overdueDays} días
                        </span>
                      </td>
                      <td className="h-11 px-3.5 text-small text-muted">
                        {loan.nextInstallmentDueDate
                          ? formatDateOnly(loan.nextInstallmentDueDate)
                          : '—'}
                      </td>
                      <td className="h-11 px-3.5">
                        <Link
                          to={`/prestamos/${loan.id}`}
                          className="rounded-[3px] border border-border bg-input px-1.75 py-1 text-meta text-muted hover:text-white"
                        >
                          Ver
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center gap-4 text-label text-muted">
          <span>Días mora:</span>
          <Legend color="#22c55e" label="0 días" />
          <Legend color="#eab308" label="1–30" />
          <Legend color="#f97316" label="31–60" />
          <Legend color="#ef4444" label="+60" />
        </div>
      </div>

      {/* Fase 5 built this scoped to the overdue reminder only; Fase 9 added
          manual triggers for the other two on-demand-capable types (Aviso
          also has a cron, but its pause/resume lives on MessageLogsPage —
          "the page about automatic sends" — not per-client). The new-loan
          message has no manual trigger by design (sent automatically at
          loan creation, see LoanDetailPage.tsx), so it never appears here
          as a button, only in the history list below like any other type. */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-section-label font-medium tracking-[0.36px] text-muted">
            HISTORIAL DE MENSAJES
          </span>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={sendReminder.isPending}
                onClick={async () => {
                  setSendError(null);
                  try {
                    await sendReminder.mutateAsync(client.id);
                  } catch (err) {
                    setSendError(
                      err instanceof ApiError
                        ? err.message
                        : 'No se pudo enviar el recordatorio.',
                    );
                  }
                }}
                className="rounded-[3px] border border-border bg-input px-2.5 py-1 text-meta text-muted hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendReminder.isPending
                  ? 'Enviando…'
                  : 'Enviar recordatorio de mora'}
              </button>
              <button
                type="button"
                disabled={sendUpcomingDueReminder.isPending}
                onClick={async () => {
                  setSendError(null);
                  try {
                    await sendUpcomingDueReminder.mutateAsync(client.id);
                  } catch (err) {
                    setSendError(
                      err instanceof ApiError
                        ? err.message
                        : 'No se pudo enviar el aviso.',
                    );
                  }
                }}
                className="rounded-[3px] border border-border bg-input px-2.5 py-1 text-meta text-muted hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendUpcomingDueReminder.isPending
                  ? 'Enviando…'
                  : 'Enviar aviso'}
              </button>
              <button
                type="button"
                disabled={sendAccountSummary.isPending}
                onClick={async () => {
                  setSendError(null);
                  try {
                    await sendAccountSummary.mutateAsync(client.id);
                  } catch (err) {
                    setSendError(
                      err instanceof ApiError
                        ? err.message
                        : 'No se pudo enviar el estado de cuenta.',
                    );
                  }
                }}
                className="rounded-[3px] border border-border bg-input px-2.5 py-1 text-meta text-muted hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendAccountSummary.isPending
                  ? 'Enviando…'
                  : 'Enviar resumen de cuenta'}
              </button>
            </div>
          )}
        </div>

        {sendError && (
          <p className="text-small text-red-400" role="alert">
            {sendError}
          </p>
        )}

        <div className="overflow-hidden rounded bg-surface">
          {messages && messages.items.length > 0 ? (
            <table className="w-full">
              <tbody>
                {messages.items.map((message) => (
                  <tr key={message.id} className="border-t border-border">
                    <td className="h-11 px-3.5 text-small text-muted">
                      {new Date(message.sentAt).toLocaleDateString('es-CO')}
                    </td>
                    <td className="h-11 px-3.5 text-small text-muted">
                      {MESSAGE_TYPE_LABELS[message.type]}
                    </td>
                    <td className="h-11 px-3.5 text-right">
                      <span
                        className={`rounded-[3px] border px-2 py-[3px] text-meta font-medium ${
                          message.status === 'sent'
                            ? 'border-[#22c55e] bg-[#051e0e] text-[#22c55e]'
                            : 'border-[#ef4444] bg-[#240a0a] text-[#ef4444]'
                        }`}
                      >
                        {message.status === 'sent' ? 'Enviado' : 'Fallido'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="border border-border p-4 text-small text-muted">
              Todavía no se le han enviado mensajes a este cliente.
            </p>
          )}
        </div>
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

// Matches the pasted screenshot: a row of 4 KPI cards between the client
// header and the loans table. Uses the same `kpi` (24px, light) type token
// documented for KPI cards in DESIGN_TOKENS.md.
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-surface p-5">
      <p className="text-small text-muted">{label}</p>
      <p className="mt-1 text-kpi font-light text-white">{value}</p>
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
      className={`h-[38px] px-3.5 text-left text-label font-medium tracking-[0.36px] text-muted ${className}`}
    >
      {children}
    </th>
  );
}

// Same as LoansListPage.tsx's Legend — kept as a local copy rather than a
// shared import since both are small one-off presentational helpers, same
// pattern as the Th duplication above.
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{label}</span>
    </span>
  );
}
