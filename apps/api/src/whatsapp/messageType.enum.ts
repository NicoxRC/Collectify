// Which WhatsApp message flow an artifact (a MessageTemplate or a
// MessageLog) belongs to — see docs/phases/PHASE_9_MESSAGE_TYPES.md.
export enum MessageType {
  NewLoan = 'new_loan',
  UpcomingDue = 'upcoming_due',
  Overdue = 'overdue',
  AccountSummary = 'account_summary',
}
