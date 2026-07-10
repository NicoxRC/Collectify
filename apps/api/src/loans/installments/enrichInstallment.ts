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
// docs/DATABASE.md, never stored, and only meaningful while unpaid.
export function enrichInstallment(
  installment: Installment,
  interestRate: number,
): InstallmentWithCalculated {
  if (installment.status === InstallmentStatus.Paid) {
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
