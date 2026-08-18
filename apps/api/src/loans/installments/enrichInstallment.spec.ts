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
});
