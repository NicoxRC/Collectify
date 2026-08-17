import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Installment, InstallmentStatus } from '../entities/installment.entity';
import { Loan, LoanStatus } from '../entities/loan.entity';
import { LoanInstallmentConcept } from '../entities/loanInstallmentConcept.entity';
import { Payment } from '../entities/payment.entity';

import { InstallmentsService } from './installments.service';

describe('InstallmentsService', () => {
  let service: InstallmentsService;
  let installmentsRepository: {
    findOneBy: jest.Mock;
    update: jest.Mock;
    find: jest.Mock;
    findAndCount: jest.Mock;
  };
  let paymentsRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };
  let loansRepository: { update: jest.Mock };
  let loanInstallmentConceptsRepository: { find: jest.Mock };

  const mockInstallment: Installment = {
    id: 'inst-1',
    loanId: 'loan-1',
    loan: undefined as never,
    installmentNumber: 1,
    amount: 200000,
    principalPortion: null,
    dueDate: '2026-01-01',
    status: InstallmentStatus.Pending,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const paymentDto = { amountPaid: 100000, paidAt: '2026-01-05' };

  beforeEach(async () => {
    installmentsRepository = {
      findOneBy: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
    };
    paymentsRepository = {
      create: jest.fn((dto: Partial<Payment>) => dto),
      save: jest.fn((payment: Partial<Payment>) => Promise.resolve(payment)),
      find: jest.fn(),
    };
    loansRepository = { update: jest.fn() };
    loanInstallmentConceptsRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstallmentsService,
        {
          provide: getRepositoryToken(Installment),
          useValue: installmentsRepository,
        },
        { provide: getRepositoryToken(Payment), useValue: paymentsRepository },
        { provide: getRepositoryToken(Loan), useValue: loansRepository },
        {
          provide: getRepositoryToken(LoanInstallmentConcept),
          useValue: loanInstallmentConceptsRepository,
        },
      ],
    }).compile();

    service = module.get<InstallmentsService>(InstallmentsService);
  });

  describe('findAll', () => {
    const installmentWithLoan: Installment = {
      ...mockInstallment,
      loan: { interestRate: 6 } as never,
    };

    it('attaches each installment its concept breakdown from LoanInstallmentConcept', async () => {
      installmentsRepository.findAndCount.mockResolvedValue([
        [installmentWithLoan],
        1,
      ]);
      loanInstallmentConceptsRepository.find.mockResolvedValue([
        {
          installmentId: installmentWithLoan.id,
          nameSnapshot: 'Interés remuneratorio',
          computedAmount: 4000,
        },
      ]);

      const result = await service.findAll({});

      expect(result.items[0].conceptBreakdown).toEqual([
        { name: 'Interés remuneratorio', amount: 4000 },
      ]);
    });

    it('returns an empty conceptBreakdown when the installment has no concepts', async () => {
      installmentsRepository.findAndCount.mockResolvedValue([
        [installmentWithLoan],
        1,
      ]);
      loanInstallmentConceptsRepository.find.mockResolvedValue([]);

      const result = await service.findAll({});

      expect(result.items[0].conceptBreakdown).toEqual([]);
      expect(loanInstallmentConceptsRepository.find).toHaveBeenCalled();
    });

    it('skips the concepts query entirely when the page is empty', async () => {
      installmentsRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({});

      expect(result.items).toEqual([]);
      expect(loanInstallmentConceptsRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('registerPayment', () => {
    it('records a partial payment without marking the installment paid', async () => {
      installmentsRepository.findOneBy.mockResolvedValue(mockInstallment);
      paymentsRepository.find.mockResolvedValue([{ amountPaid: 100000 }]);

      const result = await service.registerPayment(
        mockInstallment.id,
        paymentDto,
      );

      expect(result).toMatchObject(paymentDto);
      expect(installmentsRepository.update).not.toHaveBeenCalled();
      expect(loansRepository.update).not.toHaveBeenCalled();
    });

    it('marks the installment paid when accumulated payments cover the amount exactly', async () => {
      installmentsRepository.findOneBy.mockResolvedValue(mockInstallment);
      paymentsRepository.find.mockResolvedValue([{ amountPaid: 200000 }]);
      installmentsRepository.find.mockResolvedValue([
        { ...mockInstallment, status: InstallmentStatus.Paid },
      ]);

      await service.registerPayment(mockInstallment.id, {
        amountPaid: 200000,
        paidAt: '2026-01-05',
      });

      expect(installmentsRepository.update).toHaveBeenCalledWith(
        { id: mockInstallment.id },
        { status: InstallmentStatus.Paid },
      );
    });

    it('marks the installment paid on overpayment (accumulated exceeds the amount)', async () => {
      installmentsRepository.findOneBy.mockResolvedValue(mockInstallment);
      paymentsRepository.find.mockResolvedValue([{ amountPaid: 250000 }]);
      installmentsRepository.find.mockResolvedValue([
        { ...mockInstallment, status: InstallmentStatus.Paid },
      ]);

      await service.registerPayment(mockInstallment.id, {
        amountPaid: 250000,
        paidAt: '2026-01-05',
      });

      expect(installmentsRepository.update).toHaveBeenCalledWith(
        { id: mockInstallment.id },
        { status: InstallmentStatus.Paid },
      );
    });

    it('cascades the loan to paid when every installment of it is paid', async () => {
      installmentsRepository.findOneBy.mockResolvedValue(mockInstallment);
      paymentsRepository.find.mockResolvedValue([{ amountPaid: 200000 }]);
      installmentsRepository.find.mockResolvedValue([
        { ...mockInstallment, status: InstallmentStatus.Paid },
      ]);

      await service.registerPayment(mockInstallment.id, {
        amountPaid: 200000,
        paidAt: '2026-01-05',
      });

      expect(loansRepository.update).toHaveBeenCalledWith(
        { id: mockInstallment.loanId, status: LoanStatus.Active },
        { status: LoanStatus.Paid },
      );
    });

    it('does not cascade the loan to paid when other installments are still pending', async () => {
      installmentsRepository.findOneBy.mockResolvedValue(mockInstallment);
      paymentsRepository.find.mockResolvedValue([{ amountPaid: 200000 }]);
      installmentsRepository.find.mockResolvedValue([
        { ...mockInstallment, status: InstallmentStatus.Paid },
        { ...mockInstallment, id: 'inst-2', status: InstallmentStatus.Pending },
      ]);

      await service.registerPayment(mockInstallment.id, {
        amountPaid: 200000,
        paidAt: '2026-01-05',
      });

      expect(loansRepository.update).not.toHaveBeenCalled();
    });

    it('does not re-evaluate an already-paid installment', async () => {
      installmentsRepository.findOneBy.mockResolvedValue({
        ...mockInstallment,
        status: InstallmentStatus.Paid,
      });

      await service.registerPayment(mockInstallment.id, paymentDto);

      expect(paymentsRepository.find).not.toHaveBeenCalled();
      expect(installmentsRepository.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the installment does not exist', async () => {
      installmentsRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.registerPayment('missing-id', paymentDto),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
