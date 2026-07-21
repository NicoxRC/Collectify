import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '@/features/auth/useAuth';
import { useClient } from '@/features/clients/useClients';
import { InstallmentStatus } from '@/features/installments/installmentsApi';
import { RegisterPaymentDialog } from '@/features/installments/RegisterPaymentDialog';
import { useRegisterPayment } from '@/features/installments/useInstallments';
import {
  estadoBadge,
  moraBadgeClasses,
} from '@/features/loans/loanStatusDisplay';
import { LoanStatus } from '@/features/loans/loansApi';
import { MarkAsPaidDialog } from '@/features/loans/MarkAsPaidDialog';
import {
  useLoan,
  useLoanPayments,
  useMarkLoanAsPaid,
} from '@/features/loans/useLoans';
import { formatCurrency, formatDateOnly } from '@/lib/format';

import type { Installment } from '@/features/installments/installmentsApi';
import type { ReactNode } from 'react';

// Matches Figma frame 52:537 ("F-19 / Detalle préstamo — Desktop 1440"),
// with one addition and one removal — see
// apps/client/docs/DESIGN_TOKENS.md "Known design/backend gaps":
//   - Added a "Cuotas" table: Figma only shows payment history, but Phase
//     4's own scope requires showing each installment's overdueDays/
//     interest/totalDue "exactly as returned by GET /loans/:id" — there's
//     no other place in this design for that.
//   - "LOG DE MENSAJES WHATSAPP" and "Enviar mensaje" dropped: Phase 5/9.
export function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: loan, isLoading, isError } = useLoan(id ?? '');
  const { data: client } = useClient(loan?.clientId ?? '');
  const { data: payments } = useLoanPayments(id ?? '');
  const registerPayment = useRegisterPayment(id ?? '');
  const markAsPaid = useMarkLoanAsPaid();

  const [payingInstallment, setPayingInstallment] =
    useState<Installment | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const pendingInstallments =
    loan?.installments.filter(
      (installment) => installment.status === InstallmentStatus.Pending,
    ) ?? [];
  // Installments come back sorted by installmentNumber ASC (LoansService)
  // and due dates only increase with installment number, so the first
  // pending one is always the next due — no separate sort needed.
  const oldestPending = pendingInstallments[0] ?? null;

  // The list page's quick "Pago" action (?pago=1) lands here and opens the
  // same dialog the top "Registrar pago" button does — see
  // RegisterPaymentDialog's note on why there's no installment picker.
  useEffect(() => {
    if (searchParams.get('pago') === '1' && oldestPending) {
      setPayingInstallment(oldestPending);
      const next = new URLSearchParams(searchParams);
      next.delete('pago');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, oldestPending?.id]);

  if (!id) {
    return <p className="text-small text-muted">Préstamo no encontrado.</p>;
  }

  if (isLoading) {
    return <p className="text-small text-muted">Cargando…</p>;
  }

  if (isError || !loan) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-small text-red-400" role="alert">
          No se pudo cargar este préstamo.
        </p>
        <Link
          to="/prestamos"
          className="text-small text-muted hover:text-white"
        >
          ← Volver a Préstamos
        </Link>
      </div>
    );
  }

  const clientFullName = client
    ? `${client.firstName} ${client.lastName}`
    : '…';
  const outstandingBalance = pendingInstallments.reduce(
    (sum, installment) => sum + installment.totalDue,
    0,
  );
  const installmentsPaid = loan.installments.filter(
    (installment) => installment.status === InstallmentStatus.Paid,
  ).length;
  const overdueDays = pendingInstallments.reduce(
    (max, installment) => Math.max(max, installment.overdueDays),
    0,
  );
  const estado = estadoBadge({ status: loan.status, overdueDays });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-1.5 text-label">
        <Link to="/prestamos" className="text-muted hover:text-white">
          Préstamos
        </Link>
        <span className="text-mid">/</span>
        <span className="font-medium text-white">
          {loan.promissoryNoteNumber} — {clientFullName}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-page-title font-semibold text-white">
            Préstamo {loan.promissoryNoteNumber}
          </h1>
          <div className="flex items-center gap-2.5 text-small text-muted">
            <span>
              {clientFullName} · Creado{' '}
              {new Date(loan.createdAt).toLocaleDateString('es-CO')}
            </span>
            <span
              className={`rounded-[3px] border px-2 py-[3px] text-meta font-medium ${estado.classes}`}
            >
              {estado.label}
            </span>
            {overdueDays > 0 && (
              <span
                className={`rounded-[3px] border px-2 py-[3px] text-meta font-medium ${moraBadgeClasses(overdueDays)}`}
              >
                {overdueDays} días
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={!oldestPending}
            onClick={() => oldestPending && setPayingInstallment(oldestPending)}
            className="rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Registrar pago
          </button>
          {isAdmin && (
            <button
              type="button"
              disabled={loan.status !== LoanStatus.Active}
              onClick={() => setIsChangingStatus(true)}
              className="rounded border border-border bg-input px-4 py-2.5 text-small text-muted hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cambiar estado
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Monto original"
          value={formatCurrency(loan.principalAmount)}
        />
        <KpiCard
          label="Saldo pendiente"
          value={formatCurrency(outstandingBalance)}
        />
        <KpiCard
          label="Cuotas pagadas"
          value={`${installmentsPaid} de ${loan.totalInstallments}`}
        />
        <KpiCard
          label="Próx. pago"
          value={oldestPending ? formatDateOnly(oldestPending.dueDate) : '—'}
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-section-label font-medium tracking-[0.36px] text-muted">
          CUOTAS
        </span>
        <div className="overflow-hidden rounded bg-surface">
          <table className="w-full">
            <thead className="bg-input">
              <tr>
                <Th>Cuota</Th>
                <Th>Vence</Th>
                <Th>Monto</Th>
                <Th>Mora</Th>
                <Th>Interés</Th>
                <Th>Total</Th>
                <Th>Estado</Th>
                <Th>Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {loan.installments.map((installment) => (
                <tr key={installment.id} className="border-t border-border">
                  <Td>{installment.installmentNumber}</Td>
                  <Td>{formatDateOnly(installment.dueDate)}</Td>
                  <Td>{formatCurrency(installment.amount)}</Td>
                  <Td>
                    {installment.status === InstallmentStatus.Pending &&
                    installment.overdueDays > 0 ? (
                      <span
                        className={`rounded-[3px] border px-2 py-[3px] text-meta font-medium ${moraBadgeClasses(installment.overdueDays)}`}
                      >
                        {installment.overdueDays} días
                      </span>
                    ) : (
                      <span className="text-mid">—</span>
                    )}
                  </Td>
                  <Td>
                    {installment.interest > 0
                      ? formatCurrency(installment.interest)
                      : '—'}
                  </Td>
                  <Td className="font-medium text-white">
                    {formatCurrency(
                      installment.status === InstallmentStatus.Pending
                        ? installment.totalDue
                        : installment.amount,
                    )}
                  </Td>
                  <Td>{installmentStatusLabel(installment.status)}</Td>
                  <Td>
                    {installment.status === InstallmentStatus.Pending ? (
                      <button
                        type="button"
                        onClick={() => setPayingInstallment(installment)}
                        className="rounded-[3px] border border-border bg-input px-1.75 py-1 text-meta text-muted hover:text-white"
                      >
                        Pagar
                      </button>
                    ) : (
                      <span className="text-meta text-mid">—</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-section-label font-medium tracking-[0.36px] text-muted">
          HISTORIAL DE PAGOS
        </span>
        <div className="overflow-hidden rounded bg-surface">
          <table className="w-full">
            <thead className="bg-input">
              <tr>
                <Th className="w-10">#</Th>
                <Th>Fecha</Th>
                <Th>Monto</Th>
                <Th>Observación</Th>
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="p-6 text-center text-small text-muted"
                  >
                    Todavía no se han registrado pagos.
                  </td>
                </tr>
              )}
              {(payments ?? []).map((payment, index) => (
                <tr key={payment.id} className="border-t border-border">
                  <Td muted>{index + 1}</Td>
                  <Td>{formatDateOnly(payment.paidAt)}</Td>
                  <Td>{formatCurrency(payment.amountPaid)}</Td>
                  <Td className="font-normal text-muted">
                    {payment.observation ?? '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded border border-border bg-surface p-6 text-small text-muted">
        El log de mensajes de WhatsApp de este préstamo se mostrará aquí a
        partir de la Fase 5.
      </div>

      {payingInstallment && (
        <RegisterPaymentDialog
          installment={payingInstallment}
          loanLabel={`${loan.promissoryNoteNumber} — ${clientFullName}`}
          onClose={() => setPayingInstallment(null)}
          onConfirm={(input) =>
            registerPayment.mutateAsync({
              installmentId: payingInstallment.id,
              input,
            })
          }
        />
      )}

      {isChangingStatus && (
        <MarkAsPaidDialog
          loanLabel={`${loan.promissoryNoteNumber} — ${clientFullName}`}
          onClose={() => setIsChangingStatus(false)}
          onConfirm={() => markAsPaid.mutateAsync(loan.id)}
        />
      )}
    </div>
  );
}

function installmentStatusLabel(status: InstallmentStatus): string {
  switch (status) {
    case InstallmentStatus.Paid:
      return 'Pagada';
    case InstallmentStatus.Cancelled:
      return 'Cancelada';
    default:
      return 'Pendiente';
  }
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded border border-border bg-surface p-4">
      <span className="text-label text-muted">{label}</span>
      <span className="text-kpi font-light text-white">{value}</span>
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

function Td({
  children,
  className = '',
  muted = false,
}: {
  children: ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <td
      className={
        muted
          ? `h-11 px-3.5 text-small text-mid ${className}`
          : `h-11 px-3.5 text-small font-medium text-white ${className}`
      }
    >
      {children}
    </td>
  );
}
