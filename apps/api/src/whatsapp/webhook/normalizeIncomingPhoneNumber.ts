// Meta's webhook sends the sender's number without a leading "+" (e.g.
// "573001234567"), while clients.phone_number is stored E.164 with one
// (e.g. "+573001234567") — see docs/DATABASE.md. Normalizes so the two can
// be compared directly.
export function normalizeIncomingPhoneNumber(rawPhoneNumber: string): string {
  const trimmed = rawPhoneNumber.trim();
  return trimmed.startsWith('+') ? trimmed : `+${trimmed}`;
}
