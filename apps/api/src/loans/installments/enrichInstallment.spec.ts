import { Installment, InstallmentStatus } from '../entities/installment.entity';

import { enrichInstallment } from './enrichInstallment';

describe('enrichInstallment', () => {
  const baseInstallment: Installment = {
    id: 'installment-1',
    loanId: 'loan-1',
    loan: undefined as never,
    installmentNumber: 1,
    amount: 210000,
    principalPortion: null,
    dueDate: '2026-01-01',
    status: InstallmentStatus.Pending,
    isInitial: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  it('calculates overdueDays/interest/totalDue for a regular pending installment', () => {
    const overdue = enrichInstallment(
      { ...baseInstallment, dueDate: '2020-01-01' },
      6,
    );

    expect(overdue.overdueDays).toBeGreaterThan(0);
    expect(overdue.interest).toBeGreaterThan(0);
    expect(overdue.totalDue).toBeGreaterThan(baseInstallment.amount);
  });

  it('returns zero mora for a paid installment regardless of due date', () => {
    const result = enrichInstallment(
      {
        ...baseInstallment,
        status: InstallmentStatus.Paid,
        dueDate: '2020-01-01',
      },
      6,
    );

    expect(result).toMatchObject({ overdueDays: 0, interest: 0, totalDue: 0 });
  });

  // Phase 13 — docs/phases/PHASE_13_INITIAL_INSTALLMENT.md: a cuota inicial
  // never accrues mora, however many days past its due date.
  it('returns zero mora but keeps totalDue at the installment amount for an overdue isInitial installment', () => {
    const result = enrichInstallment(
      {
        ...baseInstallment,
        isInitial: true,
        dueDate: '2020-01-01', // years overdue
      },
      6,
    );

    expect(result).toMatchObject({
      overdueDays: 0,
      interest: 0,
      totalDue: baseInstallment.amount,
    });
  });

  it('returns zero mora for an isInitial installment that is not yet due either', () => {
    const futureDueDate = new Date();
    futureDueDate.setFullYear(futureDueDate.getFullYear() + 1);

    const result = enrichInstallment(
      {
        ...baseInstallment,
        isInitial: true,
        dueDate: futureDueDate.toISOString().slice(0, 10),
      },
      6,
    );

    expect(result).toMatchObject({
      overdueDays: 0,
      interest: 0,
      totalDue: baseInstallment.amount,
    });
  });

  it('treats a paid isInitial installment the same as any other paid installment (totalDue 0)', () => {
    const result = enrichInstallment(
      {
        ...baseInstallment,
        isInitial: true,
        status: InstallmentStatus.Paid,
        dueDate: '2020-01-01',
      },
      6,
    );

    expect(result).toMatchObject({ overdueDays: 0, interest: 0, totalDue: 0 });
  });
});
