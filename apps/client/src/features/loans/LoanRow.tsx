import { Link } from 'react-router-dom';

import {
  estadoBadge,
  moraBadgeClasses,
} from '@/features/loans/loanStatusDisplay';
import { formatCurrency } from '@/lib/format';

import type { LoanSummary } from '@/features/loans/loansApi';
import type { ReactNode } from 'react';

interface LoanRowProps {
  loan: LoanSummary;
  rowNumber: number;
}

export function LoanRow({ loan, rowNumber }: LoanRowProps) {
  const estado = estadoBadge(loan);

  return (
    <tr className="border-t border-border">
      <Td muted>{rowNumber}</Td>
      <Td>{loan.promissoryNoteNumber}</Td>
      <Td>{loan.clientFullName}</Td>
      <Td>{formatCurrency(loan.principalAmount)}</Td>
      <Td>{formatCurrency(loan.outstandingBalance)}</Td>
      <Td>
        {loan.installmentsPaid}/{loan.totalInstallments}
      </Td>
      <Td>
        <span
          className={`rounded-[3px] border px-2 py-[3px] text-meta font-medium ${moraBadgeClasses(loan.overdueDays)}`}
        >
          {loan.overdueDays} días
        </span>
      </Td>
      <Td>
        <span
          className={`rounded-[3px] border px-2 py-[3px] text-meta font-medium ${estado.classes}`}
        >
          {estado.label}
        </span>
      </Td>
      <Td>
        <div className="flex gap-2">
          <RowAction to={`/prestamos/${loan.id}`}>Ver</RowAction>
          <RowAction to={`/prestamos/${loan.id}?pago=1`}>Pago</RowAction>
        </div>
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

function RowAction({ children, to }: { children: ReactNode; to: string }) {
  return (
    <Link
      to={to}
      className="rounded-[3px] border border-border bg-input px-1.75 py-1 text-meta text-muted hover:text-white"
    >
      {children}
    </Link>
  );
}
