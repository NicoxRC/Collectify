import { ConceptCalculationType } from '../../interestConceptTypes/entities/interestConceptType.entity';

export interface ConceptAssignment {
  conceptTypeId: string;
  name: string;
  calculationType: ConceptCalculationType;
  value: number;
}

export interface GeneratedInstallmentConcept extends ConceptAssignment {
  computedAmount: number;
}

export interface GeneratedInstallment {
  installmentNumber: number;
  principalPortion: number;
  amount: number;
  concepts: GeneratedInstallmentConcept[];
}

// Amortization algorithm confirmed with the human — see
// docs/phases/PHASE_14_INTEREST_CONCEPTS.md "Resolved" and "Scope
// decisions" sections, corrected after client QA to a level total
// payment ("French"-style) instead of the originally flagged
// even-principal ("German"-style) split.
//
// Concepts are the same for every installment of a loan (set once at
// creation, not overridable per installment) — this is what makes a
// level payment well-defined. All percentage-type concepts are combined
// into a single per-period rate and solved for with the standard
// annuity formula, so the installment total (principal + every
// concept's contribution) is constant across the whole term. Internally,
// the interest/fee portion is front-loaded and the principal portion is
// back-loaded, computed on the declining balance — confirmed directly
// with the human. Fixed-amount concepts are a flat figure per
// installment, unaffected by balance, and are simply added on top of the
// level core payment (constant across installments since the concept's
// value doesn't change).
//
// The last installment absorbs any rounding remainder, so the sum of
// every principalPortion always equals principalAmount exactly — its
// total may differ from the others by a few cents as a result.
export function generateAmortizationSchedule(
  principalAmount: number,
  totalInstallments: number,
  concepts: ConceptAssignment[],
): GeneratedInstallment[] {
  if (totalInstallments < 1) {
    throw new Error('totalInstallments must be at least 1');
  }

  const percentageConcepts = concepts.filter(
    (concept) => concept.calculationType === ConceptCalculationType.Percentage,
  );
  const combinedRate =
    percentageConcepts.reduce((sum, concept) => sum + concept.value, 0) / 100;

  const corePayment = roundCurrency(
    combinedRate > 0
      ? (principalAmount * combinedRate) /
          (1 - Math.pow(1 + combinedRate, -totalInstallments))
      : principalAmount / totalInstallments,
  );

  let runningBalance = principalAmount;
  const installments: GeneratedInstallment[] = [];

  for (let index = 0; index < totalInstallments; index++) {
    const isLast = index === totalInstallments - 1;

    const computedConcepts = concepts.map((concept) => ({
      ...concept,
      computedAmount: roundCurrency(
        concept.calculationType === ConceptCalculationType.Percentage
          ? (runningBalance * concept.value) / 100
          : concept.value,
      ),
    }));

    const percentageConceptsTotal = computedConcepts
      .filter((c) => c.calculationType === ConceptCalculationType.Percentage)
      .reduce((sum, c) => sum + c.computedAmount, 0);
    const conceptsTotal = computedConcepts.reduce(
      (sum, concept) => sum + concept.computedAmount,
      0,
    );

    const principalPortion = isLast
      ? roundCurrency(runningBalance)
      : roundCurrency(corePayment - percentageConceptsTotal);

    installments.push({
      installmentNumber: index + 1,
      principalPortion,
      amount: roundCurrency(principalPortion + conceptsTotal),
      concepts: computedConcepts,
    });

    runningBalance = roundCurrency(runningBalance - principalPortion);
  }

  return installments;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
