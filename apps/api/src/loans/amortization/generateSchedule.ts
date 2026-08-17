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
// decisions" sections.
//
// Principal is split evenly across installments (linear/"German"-style
// amortization), not solved for a level total payment ("French"-style):
// concepts can vary installment-to-installment, so a level payment isn't
// well-defined in general without assumptions this project has no basis
// for. Revisit with the human if the business actually needs equal total
// payments — that requires a different, iterative calculation.
//
// Percentage-type concepts are calculated on the balance outstanding
// BEFORE that installment's principal portion is subtracted (declining
// balance) — confirmed directly with the human. Fixed-amount concepts are
// a flat figure per installment, unaffected by balance.
//
// The last installment absorbs any rounding remainder from the even
// principal split, so the sum of every principalPortion always equals
// principalAmount exactly.
export function generateAmortizationSchedule(
  principalAmount: number,
  totalInstallments: number,
  conceptsByInstallment: ConceptAssignment[][],
): GeneratedInstallment[] {
  if (totalInstallments < 1) {
    throw new Error('totalInstallments must be at least 1');
  }
  if (conceptsByInstallment.length !== totalInstallments) {
    throw new Error(
      'conceptsByInstallment must have exactly one entry per installment',
    );
  }

  const basePrincipalPortion = roundCurrency(
    principalAmount / totalInstallments,
  );
  let runningBalance = principalAmount;
  const installments: GeneratedInstallment[] = [];

  for (let index = 0; index < totalInstallments; index++) {
    const isLast = index === totalInstallments - 1;
    const principalPortion = isLast
      ? roundCurrency(runningBalance)
      : basePrincipalPortion;

    const concepts = conceptsByInstallment[index].map((concept) => ({
      ...concept,
      computedAmount: roundCurrency(
        concept.calculationType === ConceptCalculationType.Percentage
          ? (runningBalance * concept.value) / 100
          : concept.value,
      ),
    }));

    const conceptsTotal = concepts.reduce(
      (sum, concept) => sum + concept.computedAmount,
      0,
    );

    installments.push({
      installmentNumber: index + 1,
      principalPortion,
      amount: roundCurrency(principalPortion + conceptsTotal),
      concepts,
    });

    runningBalance = roundCurrency(runningBalance - principalPortion);
  }

  return installments;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
