import { differenceInDays } from 'date-fns';

import { ConceptCalculationType } from '../../interestConceptTypes/entities/interestConceptType.entity';

// Confirmed formula — verified against real spreadsheet data
// (docs/GLOSSARY.md → Interest). Do not modify without re-verifying against
// the fixtures in installmentCalculations.spec.ts.
//
// Uses differenceInDays (elapsed 24h periods, timezone-agnostic), not
// differenceInCalendarDays — the latter normalizes to local-timezone midnight,
// which silently shifts results by a day depending on server timezone since
// dueDate is parsed from a UTC-midnight date string. See installmentCalculations.spec.ts.

export function calculateOverdueDays(
  dueDate: Date,
  today: Date = new Date(),
): number {
  return today > dueDate ? differenceInDays(today, dueDate) : 0;
}

// Symmetric to calculateOverdueDays — 0 once the due date has passed or is
// today, since "days until due" only means something for a future date.
// Used by the upcoming-due and account-summary messages, see
// docs/phases/PHASE_9_MESSAGE_TYPES.md.
export function calculateDaysUntilDue(
  dueDate: Date,
  today: Date = new Date(),
): number {
  return dueDate > today ? differenceInDays(dueDate, today) : 0;
}

export function calculateInterest(
  installmentAmount: number,
  interestRate: number,
  overdueDays: number,
): number {
  return ((installmentAmount * (interestRate / 100)) / 30) * overdueDays;
}

export interface MoratoryConceptAssignment {
  name: string;
  calculationType: ConceptCalculationType;
  value: number;
}

export interface MoratoryChargeItem {
  name: string;
  amount: number;
}

// Phase 23 — the per-concept generalization of calculateInterest above,
// used when a loan has moratory concepts assigned via
// LoanInstallmentConcept (see enrichInstallment.ts and calculatePayoff.ts
// for the legacy-formula fallback when it doesn't). Computed on read, same
// as calculateInterest — never projected ahead of time, since future
// overdue days can't be known in advance (confirmed with the human, see
// docs/phases/PHASE_23_DYNAMIC_CHARGES.md).
//
// A percentage concept uses the exact same shape as calculateInterest, just
// per-concept instead of a single rate — a loan with one percentage
// moratory concept at the same value as the legacy interestRate produces an
// identical number, so migrating a loan onto the new engine causes no
// silent jump. A fixed_amount concept is charged once, flat, the moment the
// installment is overdue — it does not scale with overdueDays (confirmed
// with the human).
export function calculateMoratoryCharges(
  installmentAmount: number,
  overdueDays: number,
  concepts: MoratoryConceptAssignment[],
): MoratoryChargeItem[] {
  return concepts.map((concept) => ({
    name: concept.name,
    amount:
      overdueDays <= 0
        ? 0
        : concept.calculationType === ConceptCalculationType.Percentage
          ? ((installmentAmount * (concept.value / 100)) / 30) * overdueDays
          : concept.value,
  }));
}

export function calculateTotalDue(
  installmentAmount: number,
  interest: number,
): number {
  return installmentAmount + interest;
}
