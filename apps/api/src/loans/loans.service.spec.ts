import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
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
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let installmentsRepository: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
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
      findOne: jest.fn(),
      create: jest.fn((dto: Partial<Loan>) => dto),
      save: jest.fn(),
    };
    installmentsRepository = {
      find: jest.fn(),
      create: jest.fn((dto: Partial<Installment>) => dto),
      save: jest.fn(),
      update: jest.fn(),
    };

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

  describe('create', () => {
    const createDto = {
      clientId: 'client-1',
      promissoryNoteNumber: '#900',
      principalAmount: 900000,
      interestRate: 6,
      disbursedAt: '2026-01-01',
      installmentFrequency: InstallmentFrequency.Monthly,
      installmentAmounts: [300000, 300000, 300000],
    };

    beforeEach(() => {
      loansRepository.findOne.mockResolvedValue(null);
      loansRepository.save.mockResolvedValue({ ...mockLoan, id: 'loan-2' });
      loansRepository.findOneBy.mockResolvedValue({
        ...mockLoan,
        id: 'loan-2',
      });
      installmentsRepository.find.mockResolvedValue([]);
    });

    it('generates one installment per amount with sequential numbers and monthly due dates', async () => {
      await service.create(createDto);

      expect(installmentsRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({
          installmentNumber: 1,
          amount: 300000,
          dueDate: '2026-02-01',
        }),
        expect.objectContaining({
          installmentNumber: 2,
          amount: 300000,
          dueDate: '2026-03-01',
        }),
        expect.objectContaining({
          installmentNumber: 3,
          amount: 300000,
          dueDate: '2026-04-01',
        }),
      ]);
    });

    it('spaces due dates two weeks apart for biweekly loans', async () => {
      await service.create({
        ...createDto,
        installmentFrequency: InstallmentFrequency.Biweekly,
      });

      expect(installmentsRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ dueDate: '2026-01-15' }),
        expect.objectContaining({ dueDate: '2026-01-29' }),
        expect.objectContaining({ dueDate: '2026-02-12' }),
      ]);
    });

    it('sets totalInstallments from the installmentAmounts array length', async () => {
      await service.create(createDto);

      expect(loansRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ totalInstallments: 3 }),
      );
    });

    it('rejects a duplicate promissory note number', async () => {
      loansRepository.findOne.mockResolvedValue(mockLoan);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(loansRepository.save).not.toHaveBeenCalled();
    });

    it('rejects when installment amounts do not sum to the principal amount', async () => {
      await expect(
        service.create({ ...createDto, installmentAmounts: [100000, 100000] }),
      ).rejects.toThrow(BadRequestException);
      expect(loansRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('refinance', () => {
    const refinanceDto = {
      promissoryNoteNumber: '#1000',
      principalAmount: 600000,
      interestRate: 5,
      disbursedAt: '2026-07-10',
      installmentFrequency: InstallmentFrequency.Monthly,
      installmentAmounts: [300000, 300000],
    };

    const newLoanRecord: Loan = {
      ...mockLoan,
      id: 'loan-2',
      promissoryNoteNumber: '#1000',
      principalAmount: 600000,
      interestRate: 5,
      totalInstallments: 2,
      refinancedFromLoanId: mockLoan.id,
    };

    beforeEach(() => {
      loansRepository.findOneBy
        .mockResolvedValueOnce({ ...mockLoan }) // old loan lookup — cloned, refinance() mutates .status in place
        .mockResolvedValueOnce(newLoanRecord); // findOne(newLoan.id) at the end
      loansRepository.findOne.mockResolvedValue(null); // uniqueness check + reverse lookup
      loansRepository.save
        .mockImplementationOnce((loan: Loan) => Promise.resolve(loan)) // old loan status update
        .mockResolvedValueOnce(newLoanRecord); // new loan save
      installmentsRepository.find.mockResolvedValue([]);
    });

    it('marks the old loan as refinanced and cancels its remaining pending installments', async () => {
      await service.refinance(mockLoan.id, refinanceDto);

      expect(loansRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: LoanStatus.Refinanced }),
      );
      expect(installmentsRepository.update).toHaveBeenCalledWith(
        { loanId: mockLoan.id, status: InstallmentStatus.Pending },
        { status: InstallmentStatus.Cancelled },
      );
    });

    it('creates a new loan linked back to the old one with its own generated installments', async () => {
      await service.refinance(mockLoan.id, refinanceDto);

      expect(loansRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: mockLoan.clientId,
          refinancedFromLoanId: mockLoan.id,
          promissoryNoteNumber: '#1000',
          totalInstallments: 2,
        }),
      );
      expect(installmentsRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ installmentNumber: 1, amount: 300000 }),
        expect.objectContaining({ installmentNumber: 2, amount: 300000 }),
      ]);
    });

    it('rejects refinancing an already-paid loan', async () => {
      loansRepository.findOneBy.mockReset();
      loansRepository.findOneBy.mockResolvedValueOnce({
        ...mockLoan,
        status: LoanStatus.Paid,
      });

      await expect(
        service.refinance(mockLoan.id, refinanceDto),
      ).rejects.toThrow(BadRequestException);
      expect(loansRepository.save).not.toHaveBeenCalled();
    });

    it('rejects refinancing an already-refinanced loan', async () => {
      loansRepository.findOneBy.mockReset();
      loansRepository.findOneBy.mockResolvedValueOnce({
        ...mockLoan,
        status: LoanStatus.Refinanced,
      });

      await expect(
        service.refinance(mockLoan.id, refinanceDto),
      ).rejects.toThrow(BadRequestException);
      expect(loansRepository.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the loan does not exist', async () => {
      loansRepository.findOneBy.mockReset();
      loansRepository.findOneBy.mockResolvedValueOnce(null);

      await expect(
        service.refinance('missing-id', refinanceDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('returns the loan with calculated fields on each installment', async () => {
      loansRepository.findOneBy.mockResolvedValue(mockLoan);
      loansRepository.findOne.mockResolvedValue(null);
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

    it('returns null refinancedToLoanId when no loan points back to this one', async () => {
      loansRepository.findOneBy.mockResolvedValue(mockLoan);
      loansRepository.findOne.mockResolvedValue(null);
      installmentsRepository.find.mockResolvedValue([]);

      const result = await service.findOne(mockLoan.id);

      expect(result.refinancedToLoanId).toBeNull();
    });

    it('returns the new loan id as refinancedToLoanId when this loan was refinanced', async () => {
      loansRepository.findOneBy.mockResolvedValue(mockLoan);
      loansRepository.findOne.mockResolvedValue({ ...mockLoan, id: 'loan-2' });
      installmentsRepository.find.mockResolvedValue([]);

      const result = await service.findOne(mockLoan.id);

      expect(result.refinancedToLoanId).toBe('loan-2');
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
