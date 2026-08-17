import { ConceptCalculationType } from '../../interestConceptTypes/entities/interestConceptType.entity';

import {
  ConceptAssignment,
  generateAmortizationSchedule,
} from './generateSchedule';

function repeat(
  concepts: ConceptAssignment[],
  totalInstallments: number,
): ConceptAssignment[][] {
  return Array.from({ length: totalInstallments }, () => concepts);
}

describe('generateAmortizationSchedule', () => {
  it('splits principal evenly and applies a flat percentage concept to the declining balance', () => {
    const concept: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Interés remuneratorio',
      calculationType: ConceptCalculationType.Percentage,
      value: 2,
    };

    const schedule = generateAmortizationSchedule(
      900000,
      3,
      repeat([concept], 3),
    );

    expect(schedule).toEqual([
      expect.objectContaining({
        installmentNumber: 1,
        principalPortion: 300000,
        amount: 318000,
      }),
      expect.objectContaining({
        installmentNumber: 2,
        principalPortion: 300000,
        amount: 312000,
      }),
      expect.objectContaining({
        installmentNumber: 3,
        principalPortion: 300000,
        amount: 306000,
      }),
    ]);
    // The concept's contribution declines as the balance it's applied to
    // declines: 900000*2%, then 600000*2%, then 300000*2%.
    expect(schedule.map((i) => i.concepts[0].computedAmount)).toEqual([
      18000, 12000, 6000,
    ]);
  });

  it('sums principal portions to exactly the principal amount, including a rounding remainder', () => {
    const concept: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Interés remuneratorio',
      calculationType: ConceptCalculationType.Percentage,
      value: 2,
    };

    // 1000 / 3 = 333.333... — not evenly divisible.
    const schedule = generateAmortizationSchedule(
      1000,
      3,
      repeat([concept], 3),
    );

    const total = schedule.reduce((sum, i) => sum + i.principalPortion, 0);
    expect(total).toBeCloseTo(1000, 6);
    // The remainder lands on the last installment, not spread evenly.
    expect(schedule[0].principalPortion).toBe(333.33);
    expect(schedule[1].principalPortion).toBe(333.33);
    expect(schedule[2].principalPortion).toBe(333.34);
  });

  it('applies a fixed-amount concept identically regardless of the declining balance', () => {
    const concept: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Gastos de cobranza',
      calculationType: ConceptCalculationType.FixedAmount,
      value: 5000,
    };

    const schedule = generateAmortizationSchedule(
      300000,
      3,
      repeat([concept], 3),
    );

    expect(schedule.map((i) => i.concepts[0].computedAmount)).toEqual([
      5000, 5000, 5000,
    ]);
  });

  it('supports a mix of percentage and fixed-amount concepts on the same installment', () => {
    const percentageConcept: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Interés remuneratorio',
      calculationType: ConceptCalculationType.Percentage,
      value: 2,
    };
    const fixedConcept: ConceptAssignment = {
      conceptTypeId: 'concept-2',
      name: 'Gastos de cobranza',
      calculationType: ConceptCalculationType.FixedAmount,
      value: 5000,
    };

    const schedule = generateAmortizationSchedule(300000, 1, [
      [percentageConcept, fixedConcept],
    ]);

    // principal 300000 + 2% of 300000 (6000) + 5000 flat = 311000
    expect(schedule[0].amount).toBe(311000);
  });

  it('lets concepts vary installment-to-installment', () => {
    const interestOnly: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Interés remuneratorio',
      calculationType: ConceptCalculationType.Percentage,
      value: 2,
    };
    const interestPlusFee: ConceptAssignment = {
      conceptTypeId: 'concept-2',
      name: 'Seguro',
      calculationType: ConceptCalculationType.FixedAmount,
      value: 3000,
    };

    const schedule = generateAmortizationSchedule(200000, 2, [
      [interestOnly],
      [interestOnly, interestPlusFee],
    ]);

    expect(schedule[0].concepts).toHaveLength(1);
    expect(schedule[1].concepts).toHaveLength(2);
  });

  it('generates a single installment equal to principal plus its concepts', () => {
    const concept: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Interés remuneratorio',
      calculationType: ConceptCalculationType.Percentage,
      value: 5,
    };

    const schedule = generateAmortizationSchedule(100000, 1, [[concept]]);

    expect(schedule).toHaveLength(1);
    expect(schedule[0]).toMatchObject({
      installmentNumber: 1,
      principalPortion: 100000,
      amount: 105000,
    });
  });

  it('handles an installment with no concepts at all', () => {
    const schedule = generateAmortizationSchedule(90000, 3, repeat([], 3));

    expect(schedule.every((i) => i.amount === i.principalPortion)).toBe(true);
    expect(schedule.reduce((sum, i) => sum + i.amount, 0)).toBeCloseTo(
      90000,
      6,
    );
  });

  it('throws when totalInstallments is less than 1', () => {
    expect(() => generateAmortizationSchedule(1000, 0, [])).toThrow();
  });

  it('throws when conceptsByInstallment length does not match totalInstallments', () => {
    expect(() => generateAmortizationSchedule(1000, 2, [[]])).toThrow();
  });
});
