import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Installment, InstallmentStatus } from './entities/installment.entity';
import { InstallmentFrequency, Loan, LoanStatus } from './entities/loan.entity';
import { LoansService } from './loans.service';

describe('LoansService', () => {
  let service: LoansService;
  let loansRepository: {
    createQueryBuilder: jest.Mock;
    findOneBy: jest.Mock;
    save: jest.Mock;
  };
  let installmentsRepository: { find: jest.Mock };
  let queryBuilder: {
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    andWhere: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  const mockLoan: Loan = {
    id: 'loan-1',
    clientId: 'client-1',
    client: undefined as never,
    promissoryNoteNumber: '#743',
    principalAmount: 900000,
    interestRate: 6,
    disbursedAt: '2025-01-01',
    installmentFrequency: InstallmentFrequency.Monthly,
    totalInstallments: 3,
    status: LoanStatus.Active,
    refinancedFromLoanId: null,
    refinancedFromLoan: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    queryBuilder = {
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    loansRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOneBy: jest.fn(),
      save: jest.fn(),
    };
    installmentsRepository = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        { provide: getRepositoryToken(Loan), useValue: loansRepository },
        {
          provide: getRepositoryToken(Installment),
          useValue: installmentsRepository,
        },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
  });

  describe('findOne', () => {
    it('returns the loan with calculated fields on each installment', async () => {
      loansRepository.findOneBy.mockResolvedValue(mockLoan);
      const overdueInstallment: Installment = {
        id: 'inst-1',
        loanId: mockLoan.id,
        loan: undefined as never,
        installmentNumber: 1,
        amount: 210000,
        dueDate: '2024-01-01', // far in the past — deterministic overdue
        status: InstallmentStatus.Pending,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };
      const paidInstallment: Installment = {
        ...overdueInstallment,
        id: 'inst-2',
        installmentNumber: 2,
        status: InstallmentStatus.Paid,
      };
      installmentsRepository.find.mockResolvedValue([
        overdueInstallment,
        paidInstallment,
      ]);

      const result = await service.findOne(mockLoan.id);

      expect(result.installments[0].overdueDays).toBeGreaterThan(0);
      expect(result.installments[0].interest).toBeGreaterThan(0);
      expect(result.installments[1]).toMatchObject({
        overdueDays: 0,
        interest: 0,
        totalDue: 0,
      });
    });

    it('throws NotFoundException when the loan does not exist', async () => {
      loansRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('returns a paginated page and applies clientId/status filters', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[mockLoan], 1]);

      const result = await service.findAll({
        clientId: 'client-1',
        status: LoanStatus.Active,
      });

      expect(result).toEqual({
        items: [mockLoan],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'loan.clientId = :clientId',
        {
          clientId: 'client-1',
        },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'loan.status = :status',
        {
          status: LoanStatus.Active,
        },
      );
    });

    it('returns an empty page when there are no matches', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({});

      expect(result.items).toEqual([]);
      expect(result.meta.totalPages).toBe(0);
    });
  });

  describe('update', () => {
    it('updates the interest rate when the loan exists', async () => {
      loansRepository.findOneBy.mockResolvedValue({ ...mockLoan });
      loansRepository.save.mockImplementation((loan: Loan) =>
        Promise.resolve(loan),
      );

      const result = await service.update(mockLoan.id, { interestRate: 5 });

      expect(result.interestRate).toBe(5);
    });

    it('throws NotFoundException when the loan does not exist', async () => {
      loansRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('missing-id', { interestRate: 5 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
