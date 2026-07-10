import { differenceInCalendarDays } from 'date-fns';

// Confirmed formula — verified against real spreadsheet data
// (docs/GLOSSARY.md → Interest). Do not modify without re-verifying against
// the fixtures in installmentCalculations.spec.ts.

export function calculateOverdueDays(
  dueDate: Date,
  today: Date = new Date(),
): number {
  return today > dueDate ? differenceInCalendarDays(today, dueDate) : 0;
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
