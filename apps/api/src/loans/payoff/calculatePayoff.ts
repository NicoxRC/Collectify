import {
  calculateDaysUntilDue,
  calculateInterest,
  calculateOverdueDays,
} from '../installments/installmentCalculations';

export interface PayoffInstallmentInput {
  installmentId: string;
  installmentNumber: number;
  amount: number;
  // Nullable for installments predating Phase 14 (no capital/interest
  // split) — treated as fully principal in that legacy case, same fallback
  // used elsewhere for this column.
  principalPortion: number | null;
  dueDate: string;
  isInitial: boolean;
}

export interface PayoffInstallmentBreakdown {
  installmentId: string;
  installmentNumber: number;
  interestApplied: number;
  principalApplied: number;
  totalDue: number;
}

export interface PayoffQuote {
  installments: PayoffInstallmentBreakdown[];
  totalInterestOwed: number;
  totalPrincipalOwed: number;
  totalDue: number;
}

// Colombian Civil Code Art. 1653 ("imputación del pago a intereses"): a
// payment settles interest owed before principal, and a client can never be
// forced to pay interest that hasn't been caused yet. Confirmed with the
// human (docs/phases/PHASE_16_EARLY_PAYOFF.md "Resolved") for this
// project's specifics:
//   - "Interest" = moratory interest + every Phase 14 concept baked into an
//     installment's `amount` (everything above `principalPortion`) — not
//     just moratory interest alone.
//   - A not-yet-due installment contributes only its principalPortion, at
//     face value, with ZERO interest — no moratory interest (none has
//     accrued) and no concept charges either (they cover a period that
//     hasn't happened yet).
//   - A matured installment (due today or already overdue) contributes its
//     full concept charges plus any moratory interest, in addition to its
//     principal.
//   - An initial installment (Phase 13) contributes only its own amount as
//     principal, never as interest — consistent with it never accruing
//     mora.
//   - Allocation across multiple installments is interest-globally-then-
//     principal-globally, not a per-installment waterfall — see the phase
//     doc's "Resolved" point 2 for why this doesn't change the numbers
//     within this phase's own full-payoff-only scope, but matters for
//     Phase 17's reuse of this function.
export function calculatePayoff(
  installments: PayoffInstallmentInput[],
  interestRate: number,
  today: Date = new Date(),
): PayoffQuote {
  const breakdown = installments.map((installment) =>
    calculateInstallmentPayoff(installment, interestRate, today),
  );

  const totalInterestOwed = breakdown.reduce(
    (sum, item) => sum + item.interestApplied,
    0,
  );
  const totalPrincipalOwed = breakdown.reduce(
    (sum, item) => sum + item.principalApplied,
    0,
  );

  return {
    installments: breakdown,
    totalInterestOwed,
    totalPrincipalOwed,
    totalDue: totalInterestOwed + totalPrincipalOwed,
  };
}

function calculateInstallmentPayoff(
  installment: PayoffInstallmentInput,
  interestRate: number,
  today: Date,
): PayoffInstallmentBreakdown {
  const principalPortion = installment.principalPortion ?? installment.amount;

  if (installment.isInitial) {
    return {
      installmentId: installment.installmentId,
      installmentNumber: installment.installmentNumber,
      interestApplied: 0,
      principalApplied: installment.amount,
      totalDue: installment.amount,
    };
  }

  const dueDate = new Date(installment.dueDate);
  // 0 once the due date is today or has already passed — same "matured"
  // check calculateOverdueDays itself effectively uses, kept consistent
  // with the codebase's existing timezone-safe date-diff engine rather
  // than a fresh Date comparison (see installmentCalculations.ts's own
  // note on differenceInDays vs differenceInCalendarDays).
  const hasMatured = calculateDaysUntilDue(dueDate, today) === 0;

  if (!hasMatured) {
    return {
      installmentId: installment.installmentId,
      installmentNumber: installment.installmentNumber,
      interestApplied: 0,
      principalApplied: principalPortion,
      totalDue: principalPortion,
    };
  }

  const conceptsInterest = installment.amount - principalPortion;
  const overdueDays = calculateOverdueDays(dueDate, today);
  const moratoryInterest = calculateInterest(
    installment.amount,
    interestRate,
    overdueDays,
  );
  const interestApplied = conceptsInterest + moratoryInterest;

  return {
    installmentId: installment.installmentId,
    installmentNumber: installment.installmentNumber,
    interestApplied,
    principalApplied: principalPortion,
    totalDue: interestApplied + principalPortion,
  };
}
