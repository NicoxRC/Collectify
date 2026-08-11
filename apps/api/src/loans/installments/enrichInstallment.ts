import { Installment, InstallmentStatus } from '../entities/installment.entity';

import {
  calculateInterest,
  calculateOverdueDays,
  calculateTotalDue,
} from './installmentCalculations';

export interface InstallmentWithCalculated extends Installment {
  overdueDays: number;
  interest: number;
  totalDue: number;
}

// A paid installment owes nothing further, regardless of how late it once
// was — overdueDays/interest/totalDue are calculated-on-read per
// docs/DATABASE.md, only meaningful while pending. A cancelled installment
// (superseded by a refinance, per docs/DATABASE.md "Refinancing") is the
// same: it's excluded from active collection, so it owes nothing either.
export function enrichInstallment(
  installment: Installment,
  interestRate: number,
): InstallmentWithCalculated {
  if (installment.status !== InstallmentStatus.Pending) {
    return { ...installment, overdueDays: 0, interest: 0, totalDue: 0 };
  }

  // A cuota inicial isn't a scheduled repayment the client can be "late"
  // on, so it never accrues mora regardless of due_date — but it's still
  // owed, unlike a paid/cancelled installment above, so totalDue stays
  // the installment's own amount. See
  // docs/phases/PHASE_13_INITIAL_INSTALLMENT.md.
  if (installment.isInitial) {
    return {
      ...installment,
      overdueDays: 0,
      interest: 0,
      totalDue: installment.amount,
    };
  }

  const overdueDays = calculateOverdueDays(new Date(installment.dueDate));
  const interest = calculateInterest(
    installment.amount,
    interestRate,
    overdueDays,
  );
  const totalDue = calculateTotalDue(installment.amount, interest);

  return { ...installment, overdueDays, interest, totalDue };
}
