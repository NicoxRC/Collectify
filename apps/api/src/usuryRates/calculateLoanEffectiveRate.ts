import { ConceptCalculationType } from '../interestConceptTypes/entities/interestConceptType.entity';
import { GeneratedInstallment } from '../loans/amortization/generateSchedule';

// Confirmed with the human (docs/phases/PHASE_15_USURY_RATE.md "Resolved"):
// a loan's effective rate for usury comparison is the MAXIMUM per-installment
// rate implied by its concepts, not an annualized total-cost figure.
// Percentage concepts are already a periodic rate applied to the balance
// before that installment's principal is subtracted (the same declining
// balance generateAmortizationSchedule uses) — they contribute their
// `value` directly. Fixed-amount concepts are converted to an equivalent
// rate by dividing their computed currency amount by that same balance, so
// every concept ends up expressed on the same basis before comparing
// against the stored monthly usury ceiling.
export function calculateMaxEffectiveInstallmentRate(
  schedule: GeneratedInstallment[],
  principalAmount: number,
): number {
  let balanceBeforeInstallment = principalAmount;
  let maxRate = 0;

  for (const installment of schedule) {
    if (balanceBeforeInstallment > 0) {
      const rate = installment.concepts.reduce((sum, concept) => {
        const conceptRate =
          concept.calculationType === ConceptCalculationType.Percentage
            ? concept.value
            : (concept.computedAmount / balanceBeforeInstallment) * 100;
        return sum + conceptRate;
      }, 0);

      maxRate = Math.max(maxRate, rate);
    }

    balanceBeforeInstallment -= installment.principalPortion;
  }

  return maxRate;
}
