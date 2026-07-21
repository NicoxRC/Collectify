// Mirrors apps/api/src/loans/dueDateSchedule.ts's UTC-safe date-string
// arithmetic (kept as its own small copy here rather than importing backend
// code across the app boundary — apps/api and apps/client don't share a
// lib). Used only to work backward from "fecha de la primera cuota" — what
// LoanForm now asks the admin for, since that's what's actually written on
// the physical pagaré — to `disbursedAt`, which is what POST /loans still
// requires. The API is unchanged: it keeps generating every installment's
// due date from disbursedAt + installmentFrequency exactly as before: only
// the form's input field changed, not the contract.
//
// Same caveat as the backend's addMonthsToDateString: month-length
// clamping isn't perfectly invertible for due dates on the 29th-31st (e.g.
// subtracting a month from Mar 31 clamps to Feb 28, and adding a month back
// to Feb 28 lands on Mar 28, not Mar 31). Rare in practice, and the backend
// file has the same inherent limitation for the forward direction.

function parseDateString(dateString: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = dateString.split('-').map(Number);
  return { year, month: month - 1, day };
}

function toDateString(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export function subtractMonthsFromDateString(
  dateString: string,
  months: number,
): string {
  const { year, month, day } = parseDateString(dateString);
  const totalMonths = month - months;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;
  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const targetDay = Math.min(day, daysInTargetMonth);
  return toDateString(targetYear, targetMonth, targetDay);
}

export function subtractDaysFromDateString(
  dateString: string,
  days: number,
): string {
  const { year, month, day } = parseDateString(dateString);
  return toDateString(year, month, day - days);
}
