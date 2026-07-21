import { LoanStatus } from '@/features/loans/loansApi';

// Shared between LoanRow.tsx (list) and LoanDetailPage.tsx — exact hex
// values pulled from Figma F-16/17. Two genuinely distinct color families
// for the same semantic states ("días mora" chip vs "Estado" badge use
// different reds), not a mistake to reconcile into one shared token.
export function moraBadgeClasses(overdueDays: number): string {
  if (overdueDays === 0) {
    return 'border-[#22c55e] bg-[#051e0e] text-[#22c55e]';
  }
  if (overdueDays <= 30) {
    return 'border-[#eab308] bg-[#231b01] text-[#eab308]';
  }
  if (overdueDays <= 60) {
    return 'border-[#f97316] bg-[#251103] text-[#f97316]';
  }
  return 'border-[#ef4444] bg-[#240a0a] text-[#ef4444]';
}

// Estado is derived, not stored: "al día"/"en mora" come from overdueDays
// (docs/DATABASE.md — no overdue flag at the loan level), "Pagado" is the
// real loan.status, and "Refinanciado" is Figma's original 4th bucket
// missing a color spec — styled with our own neutral tokens instead of
// guessing a hex that was never in the file.
export function estadoBadge(loan: {
  status: LoanStatus;
  overdueDays: number;
}): { label: string; classes: string } {
  if (loan.status === LoanStatus.Paid) {
    return {
      label: 'Pagado',
      classes: 'border-[#878787] bg-surface text-[#878787]',
    };
  }
  if (loan.status === LoanStatus.Refinanced) {
    return {
      label: 'Refinanciado',
      classes: 'border-subtle bg-border text-subtle',
    };
  }
  return loan.overdueDays > 0
    ? {
        label: 'En mora',
        classes: 'border-[#d94545] bg-[#260a0a] text-[#d94545]',
      }
    : {
        label: 'Al día',
        classes: 'border-[#21c45e] bg-[#0a240a] text-[#21c45e]',
      };
}
