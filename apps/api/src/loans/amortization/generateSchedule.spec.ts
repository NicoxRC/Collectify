import {
  ConceptCalculationType,
  FixedAmountDistribution,
} from '../../interestConceptTypes/entities/interestConceptType.entity';

import {
  ConceptAssignment,
  generateAmortizationSchedule,
} from './generateSchedule';

describe('generateAmortizationSchedule', () => {
  it('produces a level total payment per installment (cuota fija), front-loading interest and back-loading capital', () => {
    const concept: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Interés remuneratorio',
      calculationType: ConceptCalculationType.Percentage,
      value: 5,
    };

    const schedule = generateAmortizationSchedule(300000, 3, [concept]);

    // Every installment's total is identical, regardless of the shifting
    // capital/interest split underneath it.
    expect(schedule.map((i) => i.amount)).toEqual([
      110162.57, 110162.57, 110162.57,
    ]);
    // Capital grows installment-to-installment...
    expect(schedule.map((i) => i.principalPortion)).toEqual([
      95162.57, 99920.7, 104916.73,
    ]);
    // ...while the interest concept's contribution shrinks, computed on
    // the declining balance.
    expect(schedule.map((i) => i.concepts[0].computedAmount)).toEqual([
      15000, 10241.87, 5245.84,
    ]);
  });

  it('sums principal portions to exactly the principal amount, including a rounding remainder', () => {
    // 1000 / 3 = 333.333... — not evenly divisible.
    const schedule = generateAmortizationSchedule(1000, 3, []);

    const total = schedule.reduce((sum, i) => sum + i.principalPortion, 0);
    expect(total).toBeCloseTo(1000, 6);
    // The remainder lands on the last installment, not spread evenly.
    expect(schedule[0].principalPortion).toBe(333.33);
    expect(schedule[1].principalPortion).toBe(333.33);
    expect(schedule[2].principalPortion).toBe(333.34);
  });

  it('split_across_installments divides a fixed-amount concept evenly, remainder on the last installment', () => {
    const concept: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Gastos de cobranza',
      calculationType: ConceptCalculationType.FixedAmount,
      value: 5000,
      fixedAmountDistribution: FixedAmountDistribution.SplitAcrossInstallments,
    };

    const schedule = generateAmortizationSchedule(300000, 3, [concept]);

    expect(schedule.map((i) => i.concepts[0].computedAmount)).toEqual([
      1666.67, 1666.67, 1666.66,
    ]);
    expect(
      schedule.reduce((sum, i) => sum + i.concepts[0].computedAmount, 0),
    ).toBeCloseTo(5000, 6);
  });

  it('first_installment_only charges the full fixed-amount concept once, zero on every other installment', () => {
    const concept: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Gastos de cobranza',
      calculationType: ConceptCalculationType.FixedAmount,
      value: 5000,
      fixedAmountDistribution: FixedAmountDistribution.FirstInstallmentOnly,
    };

    const schedule = generateAmortizationSchedule(300000, 3, [concept]);

    expect(schedule.map((i) => i.concepts[0].computedAmount)).toEqual([
      5000, 0, 0,
    ]);
    // With no percentage concept, principal is split evenly (100000 each);
    // only the first installment carries the flat fee on top.
    expect(schedule.map((i) => i.amount)).toEqual([105000, 100000, 100000]);
  });

  it('throws when a fixed-amount concept has no distribution mode configured', () => {
    const concept: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Gastos de cobranza',
      calculationType: ConceptCalculationType.FixedAmount,
      value: 5000,
    };

    expect(() => generateAmortizationSchedule(300000, 3, [concept])).toThrow(
      /fixedAmountDistribution/,
    );
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
      fixedAmountDistribution: FixedAmountDistribution.FirstInstallmentOnly,
    };

    const schedule = generateAmortizationSchedule(300000, 1, [
      percentageConcept,
      fixedConcept,
    ]);

    // Single installment: principal 300000 + 2% of 300000 (6000) + 5000
    // flat = 311000.
    expect(schedule[0].amount).toBe(311000);
  });

  it('generates a single installment equal to principal plus its concepts', () => {
    const concept: ConceptAssignment = {
      conceptTypeId: 'concept-1',
      name: 'Interés remuneratorio',
      calculationType: ConceptCalculationType.Percentage,
      value: 5,
    };

    const schedule = generateAmortizationSchedule(100000, 1, [concept]);

    expect(schedule).toHaveLength(1);
    expect(schedule[0]).toMatchObject({
      installmentNumber: 1,
      principalPortion: 100000,
      amount: 105000,
    });
  });

  it('handles a loan with no concepts at all', () => {
    const schedule = generateAmortizationSchedule(90000, 3, []);

    expect(schedule.every((i) => i.amount === i.principalPortion)).toBe(true);
    expect(schedule.map((i) => i.amount)).toEqual([30000, 30000, 30000]);
  });

  it('throws when totalInstallments is less than 1', () => {
    expect(() => generateAmortizationSchedule(1000, 0, [])).toThrow();
  });
});
