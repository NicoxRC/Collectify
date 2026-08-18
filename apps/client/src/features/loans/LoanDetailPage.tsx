import { useEffect, useState } from 'react';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';

import { useAuth } from '@/features/auth/useAuth';
import { useClient } from '@/features/clients/useClients';
import { InstallmentStatus } from '@/features/installments/installmentsApi';
import { RegisterPaymentDialog } from '@/features/installments/RegisterPaymentDialog';
import { useRegisterPayment } from '@/features/installments/useInstallments';
import { EditLoanDialog } from '@/features/loans/EditLoanDialog';
import {
  estadoBadge,
  moraBadgeClasses,
} from '@/features/loans/loanStatusDisplay';
import { LoanStatus } from '@/features/loans/loansApi';
import { MarkAsPaidDialog } from '@/features/loans/MarkAsPaidDialog';
import { PayoffDialog } from '@/features/loans/PayoffDialog';
import { RefinanceLoanForm } from '@/features/loans/RefinanceLoanForm';
import {
  useLoan,
  useLoanPayments,
  useMarkLoanAsPaid,
  usePayoffLoan,
  useRefinanceLoan,
  useUpdateLoan,
} from '@/features/loans/useLoans';
import { MessageLogStatus } from '@/features/messageLogs/messageLogsApi';
import { useMessageLogs } from '@/features/messageLogs/useMessageLogs';
import { MessageType } from '@/features/messageTemplates/messageTemplatesApi';
import { formatCurrency, formatDateOnly } from '@/lib/format';
import { useEscapeKey } from '@/lib/useEscapeKey';

import type { Installment } from '@/features/installments/installmentsApi';
import type { ReactNode } from 'react';

// Matches Figma frame 52:537 ("F-19 / Detalle préstamo — Desktop 1440"),
// with one addition and one removal — see
// apps/client/docs/DESIGN_TOKENS.md "Known design/backend gaps":
//   - Added a "Cuotas" table: Figma only shows payment history, but Phase
//     4's own scope requires showing each installment's overdueDays/
//     interest/totalDue "exactly as returned by GET /loans/:id" — there's
//     no other place in this design for that.
//   - "LOG DE MENSAJES WHATSAPP" and "Enviar mensaje" dropped: the
//     new-loan message has no manual trigger by design (sent
//     automatically at creation), so there's nothing to log/send here —
//     Fase 9 added only the "Mensaje de confirmación" status badge above
//     instead, next to the other status badges.
export function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: loan, isLoading, isError } = useLoan(id ?? '');
  const { data: client } = useClient(loan?.clientId ?? '');
  const { data: payments } = useLoanPayments(id ?? '');
  const registerPayment = useRegisterPayment(id ?? '');
  const markAsPaid = useMarkLoanAsPaid();
  const payoffLoan = usePayoffLoan();
  const updateLoan = useUpdateLoan();
  const refinanceLoan = useRefinanceLoan();

  // Phase 6: fetch whichever side of the refinance chain applies, purely
  // to show a nicer label (promissoryNoteNumber) than a bare link — both
  // are no-ops (`enabled: false`) when there's nothing to link to.
  const { data: refinancedToLoan } = useLoan(loan?.refinancedToLoanId ?? '');
  const { data: refinancedFromLoan } = useLoan(
    loan?.refinancedFromLoanId ?? '',
  );

  // Fase 9: the new-loan ("Primera vez") message is sent automatically at
  // loan creation (see NewLoanReminderService in the api), with no manual
  // trigger — this only surfaces whether it actually went through, so a
  // failed/skipped send is visible instead of silent (per
  // docs/phasesClient/PHASE_9_MESSAGE_TYPES.md). There's no loanId on
  // MessageLog (it's per-client, see docs/DATABASE.md), so the matching
  // log is found by checking which of the client's new_loan messages
  // mentions this loan's promissoryNoteNumber — the rendered message
  // always includes it ("tu pagaré #{{promissoryNoteNumber}}...", see the
  // canonical template content), so this is reliable without an extra
  // per-log items request.
  const { data: newLoanMessages } = useMessageLogs({
    clientId: loan?.clientId,
    type: MessageType.NewLoan,
    limit: 50,
  });
  const newLoanMessage = loan
    ? newLoanMessages?.items.find((message) =>
        message.messageContent.includes(loan.promissoryNoteNumber),
      )
    : undefined;

  const [payingInstallment, setPayingInstallment] =
    useState<Installment | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isRefinancing, setIsRefinancing] = useState(false);
  const [isPayingOff, setIsPayingOff] = useState(false);
  // Phase 12 — click-to-enlarge for a payment's receipt photo. No Figma
  // frame exists for this (see DESIGN_TOKENS.md); just the payment's own
  // imageUrl, no extra fetch needed.
  const [enlargedImageUrl, setEnlargedImageUrl] = useState<string | null>(null);

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

      <div className="flex items-center justify-between rounded border border-border bg-surface px-6 py-5">
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
            <span
              className={`rounded-[3px] border px-2 py-[3px] text-meta font-medium ${
                newLoanMessage?.status === MessageLogStatus.Sent
                  ? 'border-[#22c55e] bg-[#051e0e] text-[#22c55e]'
                  : newLoanMessage?.status === MessageLogStatus.Failed
                    ? 'border-[#ef4444] bg-[#240a0a] text-[#ef4444]'
                    : 'border-muted bg-border text-muted'
              }`}
            >
              Mensaje de confirmación:{' '}
              {newLoanMessage?.status === MessageLogStatus.Sent
                ? 'Enviado'
                : newLoanMessage?.status === MessageLogStatus.Failed
                  ? 'Fallido'
                  : 'No enviado'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={!oldestPending}
            onClick={() => oldestPending && setPayingInstallment(oldestPending)}
            className="rounded bg-white px-4 py-2.5 text-small font-semibold text-background hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Registrar pago
          </button>
          {isAdmin && (
            <button
              type="button"
              disabled={loan.status !== LoanStatus.Active}
              onClick={() => setIsPayingOff(true)}
              className="rounded border border-border bg-input px-4 py-2.5 text-small text-muted hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Liquidar anticipadamente
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded border border-border bg-input px-4 py-2.5 text-small text-muted hover:text-white"
            >
              Editar
            </button>
          )}
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
          {isAdmin && (
            <button
              type="button"
              disabled={loan.status !== LoanStatus.Active}
              onClick={() => setIsRefinancing(true)}
              className="rounded border border-border bg-input px-4 py-2.5 text-small text-muted hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Refinanciar
            </button>
          )}
        </div>
      </div>

      {/* Phase 6: either side of the refinance chain, whichever applies.
          A loan is never both at once (refinanced loans are closed out,
          not further refinanced), so these are mutually exclusive in
          practice, but not enforced as an if/else here since both checks
          are independently cheap and harmless. */}
      {loan.status === LoanStatus.Refinanced && loan.refinancedToLoanId && (
        <div className="rounded border border-border bg-surface px-4 py-3 text-small text-muted">
          Este préstamo fue refinanciado. Ver el préstamo nuevo:{' '}
          <Link
            to={`/prestamos/${loan.refinancedToLoanId}`}
            className="text-white hover:underline"
          >
            {refinancedToLoan?.promissoryNoteNumber ?? '…'}
          </Link>
        </div>
      )}
      {loan.refinancedFromLoanId && (
        <div className="rounded border border-border bg-surface px-4 py-3 text-small text-muted">
          Este préstamo nació de una refinanciación. Ver el préstamo original:{' '}
          <Link
            to={`/prestamos/${loan.refinancedFromLoanId}`}
            className="text-white hover:underline"
          >
            {refinancedFromLoan?.promissoryNoteNumber ?? '…'}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4">
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
        <KpiCard label="Tasa de interés" value={`${loan.interestRate}%`} />
      </div>

      {loan.description && (
        <p className="text-small">
          <span className="text-muted">Descripción: </span>
          <span className="text-white">{loan.description}</span>
        </p>
      )}

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
              {loan.installments.map((installment) => {
                // Phase 6: cancelled installments (remaining pending ones
                // on a loan at the moment it's refinanced — see
                // docs/DATABASE.md "Refinancing") are kept, not hidden, but
                // shown visually de-emphasized so they read as historical
                // record rather than something still actionable.
                const isCancelled =
                  installment.status === InstallmentStatus.Cancelled;
                return (
                  <tr
                    key={installment.id}
                    className={`border-t border-border ${isCancelled ? 'opacity-50' : ''}`}
                  >
                    <Td>{installment.installmentNumber}</Td>
                    <Td>{formatDateOnly(installment.dueDate)}</Td>
                    {/* Phase 14: capital/concept breakdown shown inline
                        under the total — this is the "so a client can be
                        told exactly what they owe and why" requirement
                        from docs/phases/PHASE_14_INTEREST_CONCEPTS.md.
                        Empty for installments generated before that phase
                        (conceptBreakdown is []). */}
                    <Td>
                      {formatCurrency(installment.amount)}
                      {installment.conceptBreakdown.length > 0 && (
                        <div className="mt-0.5 flex flex-col text-meta text-mid">
                          {installment.principalPortion != null && (
                            <span>
                              Capital:{' '}
                              {formatCurrency(installment.principalPortion)}
                            </span>
                          )}
                          {installment.conceptBreakdown.map((concept) => (
                            <span key={concept.name}>
                              {concept.name}: {formatCurrency(concept.amount)}
                            </span>
                          ))}
                        </div>
                      )}
                    </Td>
                    <Td>
                      {installment.isInitial ? (
                        // Phase 13 — a cuota inicial never accrues mora,
                        // however far past its due date, so it never shows
                        // the days-overdue badge. See
                        // docs/phases/PHASE_13_INITIAL_INSTALLMENT.md.
                        <span className="rounded-[3px] border border-mid bg-surface px-2 py-[3px] text-meta font-medium text-mid">
                          Sin mora
                        </span>
                      ) : installment.status === InstallmentStatus.Pending &&
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
                    <Td>
                      {isCancelled ? (
                        <span className="rounded-[3px] border border-mid bg-surface px-2 py-[3px] text-meta font-medium text-mid">
                          Cancelada
                        </span>
                      ) : (
                        installmentStatusLabel(installment.status)
                      )}
                    </Td>
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
                );
              })}
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
                <Th>Comprobante</Th>
              </tr>
            </thead>
            <tbody>
              {(payments ?? []).length === 0 && (
                <tr>
                  <td
                    colSpan={5}
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
                  <Td>
                    {payment.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setEnlargedImageUrl(payment.imageUrl)}
                        className="block"
                      >
                        <img
                          src={payment.imageUrl}
                          alt={`Comprobante del pago del ${formatDateOnly(payment.paidAt)}`}
                          className="h-8 w-8 rounded border border-border object-cover hover:border-subtle"
                        />
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

      {/* Updated in Fase 5, now that the real shape is known: WhatsApp
          messages are consolidated per CLIENT (one reminder can cover
          several loans at once), not per loan — there's no "this loan's
          messages" to show here. The client's message history lives on
          ClientDetailPage.tsx instead. */}
      <div className="rounded border border-border bg-surface p-6 text-small text-muted">
        Los mensajes de WhatsApp se agrupan por cliente, no por préstamo —
        puedes verlos en la ficha de{' '}
        <Link
          to={`/clientes/${loan.clientId}`}
          className="text-white hover:underline"
        >
          {clientFullName}
        </Link>
        .
      </div>

      {enlargedImageUrl && (
        <ImageLightbox
          imageUrl={enlargedImageUrl}
          onClose={() => setEnlargedImageUrl(null)}
        />
      )}

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

      {isPayingOff && (
        <PayoffDialog
          loanId={loan.id}
          loanLabel={`${loan.promissoryNoteNumber} — ${clientFullName}`}
          onClose={() => setIsPayingOff(false)}
          onConfirm={() => payoffLoan.mutateAsync(loan.id)}
        />
      )}

      {isEditing && (
        <EditLoanDialog
          loanLabel={`${loan.promissoryNoteNumber} — ${clientFullName}`}
          interestRate={loan.interestRate}
          description={loan.description}
          onClose={() => setIsEditing(false)}
          onConfirm={(input) => updateLoan.mutateAsync({ id: loan.id, input })}
        />
      )}

      {isRefinancing && (
        <RefinanceLoanForm
          oldLoanId={loan.id}
          oldLoanLabel={`${loan.promissoryNoteNumber} — ${clientFullName}`}
          oldLoanOutstandingBalance={outstandingBalance}
          onClose={() => setIsRefinancing(false)}
          onSubmit={async (input) => {
            const newLoan = await refinanceLoan.mutateAsync({
              id: loan.id,
              input,
            });
            // Land on the new loan, not the now-refinanced old one — it's
            // the one the admin actually cares about going forward.
            navigate(`/prestamos/${newLoan.id}`);
          }}
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
      className={`h-[38px] px-3.5 text-left text-label font-medium tracking-[0.36px] text-muted ${className}`}
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

// Phase 12 — click-to-enlarge view for a payment's receipt photo. Its own
// component (not inline JSX) so useEscapeKey only attaches its listener
// while the lightbox is actually mounted, same pattern as every other
// dialog in this file (RegisterPaymentDialog, MarkAsPaidDialog, etc.).
function ImageLightbox({
  imageUrl,
  onClose,
}: {
  imageUrl: string;
  onClose: () => void;
}) {
  useEscapeKey(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <img
        src={imageUrl}
        alt="Comprobante de pago ampliado"
        className="max-h-[85vh] max-w-[85vw] rounded border border-border object-contain"
        // Prevents a click on the image itself from bubbling up to the
        // backdrop's onClose — otherwise there'd be no way to right-click
        // or select the image without immediately closing the lightbox.
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
