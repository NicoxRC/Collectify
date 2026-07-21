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
