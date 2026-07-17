// Pure UTC date-string arithmetic for generating installment due dates.
//
// date-fns' addMonths/addWeeks + format operate on the JS Date's LOCAL
// getters/setters. Since disbursedAt/dueDate are 'date' columns (parsed as
// UTC midnight, no time-of-day), that combination silently shifts the
// result by a day on any server running behind UTC (e.g. America/Bogota,
// UTC-5) — verified empirically before writing this. Everything here uses
// Date.UTC / getUTC*/toISOString exclusively to stay timezone-proof.

function parseDateString(dateString: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = dateString.split('-').map(Number);
  return { year, month: month - 1, day }; // month is 0-indexed to match Date.UTC
}

function toDateString(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

export function addMonthsToDateString(
  dateString: string,
  months: number,
): string {
  const { year, month, day } = parseDateString(dateString);
  const totalMonths = month + months;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  // Clamp to the last day of the target month instead of overflowing into
  // the next one (e.g. Jan 31 + 1 month -> Feb 28/29, not Mar 3).
  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const targetDay = Math.min(day, daysInTargetMonth);

  return toDateString(targetYear, targetMonth, targetDay);
}

export function addWeeksToDateString(
  dateString: string,
  weeks: number,
): string {
  const { year, month, day } = parseDateString(dateString);
  return toDateString(year, month, day + weeks * 7);
}

export function addDaysToDateString(dateString: string, days: number): string {
  const { year, month, day } = parseDateString(dateString);
  return toDateString(year, month, day + days);
}

// UTC-midnight 'YYYY-MM-DD' for "today" — matches how 'date' columns are
// parsed, so comparisons against dueDate stay timezone-proof.
export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
