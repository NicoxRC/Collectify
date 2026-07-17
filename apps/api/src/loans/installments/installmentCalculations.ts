import { differenceInDays } from 'date-fns';

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

export function calculateTotalDue(
  installmentAmount: number,
  interest: number,
): number {
  return installmentAmount + interest;
}
