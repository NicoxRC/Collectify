// Pure date-string arithmetic for the monthly report's [start, end] range —
// disbursedAt/paidAt are 'date' columns (plain YYYY-MM-DD strings), so this
// avoids the local-timezone traps documented in loans/dueDateSchedule.ts by
// never constructing a JS Date from a partial local calendar date.
export function monthBoundaries(
  year: number,
  month: number,
): { start: string; end: string } {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (value: number): string => String(value).padStart(2, '0');

  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(lastDay)}`,
  };
}
