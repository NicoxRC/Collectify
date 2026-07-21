// Colombian numbers are stored/validated as +57 followed by 10 digits (see
// features/clients/ClientForm.tsx's CO_PHONE_REGEX). This just adds spacing
// for readability in the UI — the stored value is untouched.
// "+573205704455" -> "+57 320 570 4455"
export function formatPhoneNumber(phoneNumber: string): string {
  const match = /^(\+57)(\d{3})(\d{3})(\d{4})$/.exec(phoneNumber);
  if (!match) {
    return phoneNumber;
  }
  const [, prefix, part1, part2, part3] = match;
  return `${prefix} ${part1} ${part2} ${part3}`;
}

// Colombian peso formatting (dot as thousands separator, no cents shown —
// amounts are DECIMAL(12,2) but the business always deals in whole pesos in
// every real example seen in docs/DATABASE.md). Used across Préstamos.
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Renders a date-ONLY string ('YYYY-MM-DD' — disbursedAt, installment
// dueDate, payment paidAt: all Postgres 'date' columns, no time-of-day) for
// display. `new Date('2026-10-01')` parses that as UTC midnight; calling
// .toLocaleDateString() on it converts that instant to the BROWSER's local
// timezone before formatting, which rolls the calendar day back by one for
// any timezone behind UTC — e.g. America/Bogota (UTC-5) turns "2026-10-01"
// into "30/9/2026". Forcing timeZone: 'UTC' keeps the date-only string's
// actual calendar day intact regardless of the viewer's clock. Don't use
// this for real timestamps (createdAt/updatedAt) — those should keep
// converting to the viewer's local time, which is the correct behavior.
export function formatDateOnly(dateString: string): string {
  return new Date(dateString).toLocaleDateString('es-CO', {
    timeZone: 'UTC',
  });
}
