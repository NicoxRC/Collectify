import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Header } from '@/components/layout/Header';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth/useAuth';
import { OverdueClientsSortBy } from '@/features/dashboard/dashboardApi';
import {
  useDashboardSummary,
  useMonthlyReport,
  useOverdueClients,
} from '@/features/dashboard/useDashboard';
import { moraBadgeClasses } from '@/features/loans/loanStatusDisplay';
import { formatCurrency } from '@/lib/format';

import type { ReactNode } from 'react';

const SORT_OPTIONS = [
  { value: OverdueClientsSortBy.TotalOverdueAmount, label: 'Monto total' },
  { value: OverdueClientsSortBy.MaxOverdueDays, label: 'Días de mora' },
];

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const now = new Date();
const MONTH_OPTIONS = MONTH_NAMES.map((label, index) => ({
  value: String(index + 1),
  label,
}));
// Last 3 years plus the current one — this business has no data before its
// own founding, and a report for a future year would always be empty, so a
// short fixed range is enough rather than an open-ended input.
const YEAR_OPTIONS = [0, 1, 2, 3].map((offset) => {
  const year = now.getFullYear() - offset;
  return { value: String(year), label: String(year) };
});

// No new Figma design was reviewed for this screen — client explicitly
// chose (see AskUserQuestion during Fase 7) to build it from scratch
// against the real GET /dashboard/* contract, following the same
// KPI-card/sortable-table patterns already established elsewhere in the
// app (ClientDetailPage's stat cards, LoansListPage's sortable/paginated
// table), rather than reconstructing the pasted screenshots from memory.
// Same 3 real endpoints for both roles — the backend has no "collector
// assigned to client" concept anywhere in the data model, so the
// Cobrador-specific KPIs from that earlier screenshot ("Mis asignados",
// "Contactados", "Recaudado") aren't backed by anything real and were never
// built. What IS role-gated (client's explicit rule, post-review): a
// cobrador must not see any monetary figure except the overdue-clients
// list itself (needed to actually collect) — "Monto total en mora" and
// "Pagos recibidos" are admin-only cards. See DESIGN_TOKENS.md.
export function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [sortBy, setSortBy] = useState<OverdueClientsSortBy>(
    OverdueClientsSortBy.TotalOverdueAmount,
  );
  const [page, setPage] = useState(1);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();
  const {
    data: overdueClients,
    isLoading: overdueLoading,
    isError: overdueError,
  } = useOverdueClients({ sortBy, page });
  const { data: monthlyReport, isLoading: reportLoading } = useMonthlyReport(
    month,
    year,
  );

  const clients = overdueClients?.items ?? [];
  const meta = overdueClients?.meta;

  return (
    <div className="flex flex-col gap-5">
      <Header title="Dashboard" subtitle="Resumen general de la cartera" />

      <div className="flex flex-col gap-2.5">
        <span className="text-section-label font-medium tracking-[0.36px] text-muted">
          KPIS
        </span>

        <div
          className={`grid gap-4 ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'}`}
        >
          <StatCard
            label="Clientes con préstamos activos"
            value={
              summaryLoading ? '—' : String(summary?.totalActiveClients ?? 0)
            }
          />
          <StatCard
            label="Cuotas en mora"
            value={
              summaryLoading
                ? '—'
                : String(summary?.totalOverdueInstallments ?? 0)
            }
          />
          {isAdmin && (
            <StatCard
              label="Monto total en mora"
              value={
                summaryLoading
                  ? '—'
                  : formatCurrency(summary?.totalAmountOverdue ?? 0)
              }
            />
          )}
          <StatCard
            label="Mensajes enviados esta semana"
            value={
              summaryLoading ? '—' : String(summary?.messagesSentThisWeek ?? 0)
            }
          />
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-section-label font-medium tracking-[0.36px] text-muted">
            CLIENTES EN MORA
          </span>
          <div className="flex items-center gap-2">
            <span className="text-label text-muted">Ordenar por</span>
            <Select
              value={sortBy}
              onChange={(next) => {
                setSortBy(next as OverdueClientsSortBy);
                setPage(1);
              }}
              options={SORT_OPTIONS}
              className="w-[160px]"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded bg-surface">
          <table className="w-full">
            <thead className="bg-input">
              <tr>
                <Th>Cliente</Th>
                <Th>Monto total en mora</Th>
                <Th>Cuotas vencidas</Th>
                <Th>Días de mora</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {overdueLoading && <EmptyRow>Cargando…</EmptyRow>}
              {overdueError && (
                <EmptyRow tone="error">
                  No se pudo cargar la lista de clientes en mora.
                </EmptyRow>
              )}
              {!overdueLoading && !overdueError && clients.length === 0 && (
                <EmptyRow>
                  Ningún cliente tiene cuotas en mora ahora mismo.
                </EmptyRow>
              )}
              {clients.map((client) => (
                <tr key={client.clientId} className="border-t border-border">
                  <td className="h-11 px-3.5 text-small font-medium text-white">
                    {client.firstName} {client.lastName}
                  </td>
                  <td className="h-11 px-3.5 text-small font-medium text-white">
                    {formatCurrency(client.totalOverdueAmount)}
                  </td>
                  <td className="h-11 px-3.5 text-small text-muted">
                    {client.overdueInstallmentsCount}
                  </td>
                  <td className="h-11 px-3.5">
                    <span
                      className={`rounded-[3px] border px-2 py-[3px] text-meta font-medium ${moraBadgeClasses(client.maxOverdueDays)}`}
                    >
                      {client.maxOverdueDays} días
                    </span>
                  </td>
                  <td className="h-11 px-3.5">
                    <Link
                      to={`/clientes/${client.clientId}`}
                      className="rounded-[3px] border border-border bg-input px-1.75 py-1 text-meta text-muted hover:text-white"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
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
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-section-label font-medium tracking-[0.36px] text-muted">
            REPORTE MENSUAL
          </span>
          <div className="flex items-center gap-2">
            <Select
              value={String(month)}
              onChange={(next) => setMonth(Number(next))}
              options={MONTH_OPTIONS}
              className="w-[150px]"
            />
            <Select
              value={String(year)}
              onChange={(next) => setYear(Number(next))}
              options={YEAR_OPTIONS}
              className="w-[100px]"
            />
          </div>
        </div>

        <div
          className={`grid gap-4 ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}
        >
          <StatCard
            label="Préstamos nuevos"
            value={
              reportLoading
                ? '—'
                : String(monthlyReport?.newLoansDisbursed ?? 0)
            }
          />
          {isAdmin && (
            <StatCard
              label="Pagos recibidos"
              value={
                reportLoading
                  ? '—'
                  : formatCurrency(monthlyReport?.totalPaymentsReceived ?? 0)
              }
            />
          )}
          <StatCard
            label="Mensajes enviados"
            value={
              reportLoading ? '—' : String(monthlyReport?.messagesSent ?? 0)
            }
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-surface p-5">
      <p className="text-small text-muted">{label}</p>
      <p className="mt-1 text-kpi font-light text-white">{value}</p>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="h-[38px] px-3.5 text-left text-label font-medium tracking-[0.36px] text-muted">
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
        colSpan={5}
        className={`p-6 text-center text-small ${tone === 'error' ? 'text-red-400' : 'text-muted'}`}
      >
        {children}
      </td>
    </tr>
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
          : 'bg-input text-muted disabled:opacity-40'
      }`}
    >
      {children}
    </button>
  );
}
