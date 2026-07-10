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

  const overdueDays = calculateOverdueDays(new Date(installment.dueDate));
  const interest = calculateInterest(
    installment.amount,
    interestRate,
    overdueDays,
  );
  const totalDue = calculateTotalDue(installment.amount, interest);

  return { ...installment, overdueDays, interest, totalDue };
}
