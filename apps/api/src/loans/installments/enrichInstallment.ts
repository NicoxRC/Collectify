import { Installment, InstallmentStatus } from '../entities/installment.entity';
import { LoanInstallmentConcept } from '../entities/loanInstallmentConcept.entity';

import {
  calculateInterest,
  calculateOverdueDays,
  calculateTotalDue,
} from './installmentCalculations';

export interface ConceptBreakdownItem {
  name: string;
  amount: number;
}

export interface InstallmentWithCalculated extends Installment {
  overdueDays: number;
  interest: number;
  totalDue: number;
  conceptBreakdown: ConceptBreakdownItem[];
}

// A paid installment owes nothing further, regardless of how late it once
// was — overdueDays/interest/totalDue are calculated-on-read per
// docs/DATABASE.md, only meaningful while pending. A cancelled installment
// (superseded by a refinance, per docs/DATABASE.md "Refinancing") is the
// same: it's excluded from active collection, so it owes nothing either.
// conceptBreakdown, unlike overdueDays/interest/totalDue, is NOT
// recalculated here — it's read straight from the LoanInstallmentConcept
// rows stored at generation time (docs/phases/PHASE_14_INTEREST_CONCEPTS.md),
// since the schedule doesn't change with the passage of time the way mora
// does. `concepts` defaults to [] so every existing caller that doesn't
// need the breakdown (e.g. WhatsApp message rendering) is unaffected.
export function enrichInstallment(
  installment: Installment,
  interestRate: number,
  concepts: LoanInstallmentConcept[] = [],
): InstallmentWithCalculated {
  const conceptBreakdown = concepts.map((concept) => ({
    name: concept.nameSnapshot,
    amount: concept.computedAmount,
  }));

  if (installment.status !== InstallmentStatus.Pending) {
    return {
      ...installment,
      overdueDays: 0,
      interest: 0,
      totalDue: 0,
      conceptBreakdown,
    };
  }

  const overdueDays = calculateOverdueDays(new Date(installment.dueDate));
  const interest = calculateInterest(
    installment.amount,
    interestRate,
    overdueDays,
  );
  const totalDue = calculateTotalDue(installment.amount, interest);

  return {
    ...installment,
    overdueDays,
    interest,
    totalDue,
    conceptBreakdown,
  };
}
