import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ClientsService } from '../clients/clients.service';
import { NewLoanReminderService } from '../whatsapp/newLoanReminder.service';

import { Installment, InstallmentStatus } from './entities/installment.entity';
import { InstallmentFrequency, Loan, LoanStatus } from './entities/loan.entity';
import { Payment } from './entities/payment.entity';
import { LoansService } from './loans.service';

describe('LoansService', () => {
  let service: LoansService;
  let loansRepository: {
    find: jest.Mock;
    findOneBy: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let installmentsRepository: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let paymentsRepository: { find: jest.Mock };
  let newLoanReminderService: { sendNewLoanMessage: jest.Mock };
  let clientsService: { hasMoraBlock: jest.Mock; getCreditUsage: jest.Mock };

  const mockLoan: Loan = {
    id: 'loan-1',
    clientId: 'client-1',
    client: { firstName: 'Juana', lastName: 'Pérez' } as never,
    promissoryNoteNumber: '#743',
    principalAmount: 900000,
    interestRate: 6,
    disbursedAt: '2025-01-01',
    installmentFrequency: InstallmentFrequency.Monthly,
    totalInstallments: 3,
    status: LoanStatus.Active,
    refinancedFromLoanId: null,
    refinancedFromLoan: null,
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    loansRepository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto: Partial<Loan>) => dto),
      save: jest.fn(),
      update: jest.fn(),
    };
    installmentsRepository = {
      find: jest.fn(),
      create: jest.fn((dto: Partial<Installment>) => dto),
      save: jest.fn(),
      update: jest.fn(),
    };
    paymentsRepository = {
      find: jest.fn(),
    };
    newLoanReminderService = {
      sendNewLoanMessage: jest.fn().mockResolvedValue(undefined),
    };
    // Default: no mora block, no cupo configured (creditAvailable: null
    // means unrestricted — see ClientsService.getCreditUsage) — so every
    // pre-existing test below, which doesn't care about Phase 10 at all,
    // keeps passing unaffected. Tests that DO care override these.
    clientsService = {
      hasMoraBlock: jest.fn().mockResolvedValue(false),
      getCreditUsage: jest.fn().mockResolvedValue({
        creditLimit: null,
        creditUsed: 0,
        creditAvailable: null,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        { provide: getRepositoryToken(Loan), useValue: loansRepository },
        {
          provide: getRepositoryToken(Installment),
          useValue: installmentsRepository,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: paymentsRepository,
        },
        {
          provide: NewLoanReminderService,
          useValue: newLoanReminderService,
        },
        { provide: ClientsService, useValue: clientsService },
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

    // Phase 13 — docs/phases/PHASE_13_INITIAL_INSTALLMENT.md.
    it('flags only the chosen installment as isInitial, leaving the rest false', async () => {
      await service.create({ ...createDto, initialInstallmentIndex: 0 });

      expect(installmentsRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ installmentNumber: 1, isInitial: true }),
        expect.objectContaining({ installmentNumber: 2, isInitial: false }),
        expect.objectContaining({ installmentNumber: 3, isInitial: false }),
      ]);
    });

    it('flags every installment isInitial: false when no index is given', async () => {
      await service.create(createDto);

      expect(installmentsRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ isInitial: false }),
        expect.objectContaining({ isInitial: false }),
        expect.objectContaining({ isInitial: false }),
      ]);
    });

    it('rejects when initialInstallmentIndex is out of range for installmentAmounts', async () => {
      await expect(
        service.create({ ...createDto, initialInstallmentIndex: 3 }),
      ).rejects.toThrow(BadRequestException);
      expect(loansRepository.save).not.toHaveBeenCalled();
    });

    it('sends the new-loan WhatsApp message for the created loan', async () => {
      await service.create(createDto);

      expect(newLoanReminderService.sendNewLoanMessage).toHaveBeenCalledWith(
        'loan-2',
      );
    });

    it('still returns the created loan when the new-loan message fails to send', async () => {
      newLoanReminderService.sendNewLoanMessage.mockRejectedValue(
        new Error('WhatsApp is down'),
      );

      const result = await service.create(createDto);

      expect(result.id).toBe('loan-2');
    });

    // Phase 10 — docs/phases/PHASE_10_CLIENT_CAPACITY.md's cupo/mora-block
    // guard. Mora-block is checked first and reported as a distinct reason
    // from "over cupo" — both are asserted below.
    it('rejects when the client is mora-blocked, even with cupo available', async () => {
      clientsService.hasMoraBlock.mockResolvedValue(true);

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(loansRepository.save).not.toHaveBeenCalled();
    });

    it("rejects when the principal exceeds the client's available cupo", async () => {
      clientsService.getCreditUsage.mockResolvedValue({
        creditLimit: 500000,
        creditUsed: 200000,
        creditAvailable: 300000, // less than createDto's 900000 principal
      });

      await expect(service.create(createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(loansRepository.save).not.toHaveBeenCalled();
    });

    it('reports mora-block and over-cupo as distinct error messages', async () => {
      clientsService.hasMoraBlock.mockResolvedValue(true);
      let moraMessage = '';
      try {
        await service.create(createDto);
      } catch (error) {
        moraMessage = (error as BadRequestException).message;
      }

      clientsService.hasMoraBlock.mockResolvedValue(false);
      clientsService.getCreditUsage.mockResolvedValue({
        creditLimit: 500000,
        creditUsed: 500000,
        creditAvailable: 0,
      });
      let cupoMessage = '';
      try {
        await service.create(createDto);
      } catch (error) {
        cupoMessage = (error as BadRequestException).message;
      }

      expect(moraMessage).not.toBe('');
      expect(cupoMessage).not.toBe('');
      expect(moraMessage).not.toBe(cupoMessage);
    });

    it('allows the loan when within cupo and not mora-blocked', async () => {
      clientsService.hasMoraBlock.mockResolvedValue(false);
      clientsService.getCreditUsage.mockResolvedValue({
        creditLimit: 2000000,
        creditUsed: 0,
        creditAvailable: 2000000,
      });

      const result = await service.create(createDto);

      expect(result.id).toBe('loan-2');
      expect(loansRepository.save).toHaveBeenCalled();
    });

    it('allows the loan regardless of principal when the client has no cupo configured', async () => {
      clientsService.getCreditUsage.mockResolvedValue({
        creditLimit: null,
        creditUsed: 0,
        creditAvailable: null,
      });

      const result = await service.create(createDto);

      expect(result.id).toBe('loan-2');
    });

    it("checks mora-block and cupo for the loan's clientId", async () => {
      await service.create(createDto);

      expect(clientsService.hasMoraBlock).toHaveBeenCalledWith('client-1');
      expect(clientsService.getCreditUsage).toHaveBeenCalledWith('client-1');
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

    it('sends the new-loan WhatsApp message for the new loan', async () => {
      await service.refinance(mockLoan.id, refinanceDto);

      expect(newLoanReminderService.sendNewLoanMessage).toHaveBeenCalledWith(
        'loan-2',
      );
    });

    // Phase 13 — docs/phases/PHASE_13_INITIAL_INSTALLMENT.md.
    it('flags only the chosen installment as isInitial on the new loan', async () => {
      await service.refinance(mockLoan.id, {
        ...refinanceDto,
        initialInstallmentIndex: 1,
      });

      expect(installmentsRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ installmentNumber: 1, isInitial: false }),
        expect.objectContaining({ installmentNumber: 2, isInitial: true }),
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
        isInitial: false,
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
    beforeEach(() => {
      installmentsRepository.find.mockResolvedValue([]);
    });

    it('returns a paginated page and applies clientId/status filters', async () => {
      loansRepository.find.mockResolvedValue([mockLoan]);

      const result = await service.findAll({
        clientId: 'client-1',
        status: LoanStatus.Active,
      });

      expect(result).toEqual({
        items: [
          expect.objectContaining({
            id: 'loan-1',
            clientFullName: 'Juana Pérez',
            outstandingBalance: 0,
            installmentsPaid: 0,
            overdueDays: 0,
          }),
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      expect(loansRepository.find).toHaveBeenCalledWith({
        where: { clientId: 'client-1', status: LoanStatus.Active },
        relations: { client: true },
      });
    });

    it('applies the search term as an OR across client name and promissory note number', async () => {
      loansRepository.find.mockResolvedValue([mockLoan]);

      await service.findAll({ search: 'Juana' });

      const [[callArg]] = loansRepository.find.mock.calls as [
        [
          {
            where: Array<{
              client?: { firstName?: unknown; lastName?: unknown };
              promissoryNoteNumber?: unknown;
            }>;
          },
        ],
      ];
      expect(callArg.where).toHaveLength(3);
      const operators = callArg.where.map(
        (condition) =>
          condition.client?.firstName ??
          condition.client?.lastName ??
          condition.promissoryNoteNumber,
      );
      for (const operator of operators) {
        expect(operator).toMatchObject({ _type: 'ilike', _value: '%Juana%' });
      }
    });

    it('returns an empty page when there are no matches', async () => {
      loansRepository.find.mockResolvedValue([]);

      const result = await service.findAll({});

      expect(result.items).toEqual([]);
      expect(result.meta.totalPages).toBe(0);
      expect(installmentsRepository.find).not.toHaveBeenCalled();
    });

    it('hides a loan whose client was soft-deleted instead of throwing', async () => {
      const orphanedLoan = { ...mockLoan, id: 'loan-orphan', client: null };
      loansRepository.find.mockResolvedValue([mockLoan, orphanedLoan]);

      const result = await service.findAll({});

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('loan-1');
      expect(result.meta.total).toBe(1);
    });

    it('sorts loans by the numeric part of their promissory note number', async () => {
      const loan101 = {
        ...mockLoan,
        id: 'loan-101',
        promissoryNoteNumber: '#101',
      };
      const loan2 = { ...mockLoan, id: 'loan-2', promissoryNoteNumber: '#2' };
      const loan20 = {
        ...mockLoan,
        id: 'loan-20',
        promissoryNoteNumber: '#20',
      };
      loansRepository.find.mockResolvedValue([loan101, loan2, loan20]);

      const result = await service.findAll({});

      expect(result.items.map((loan) => loan.id)).toEqual([
        'loan-2',
        'loan-20',
        'loan-101',
      ]);
    });

    it('aggregates outstandingBalance, installmentsPaid, and overdueDays from installments', async () => {
      loansRepository.find.mockResolvedValue([mockLoan]);
      const overdueDueDate = new Date();
      overdueDueDate.setDate(overdueDueDate.getDate() - 10);
      const overdueDateString = overdueDueDate.toISOString().slice(0, 10);

      installmentsRepository.find.mockResolvedValue([
        {
          id: 'installment-1',
          loanId: 'loan-1',
          installmentNumber: 1,
          amount: 300000,
          dueDate: overdueDateString,
          status: InstallmentStatus.Pending,
        },
        {
          id: 'installment-2',
          loanId: 'loan-1',
          installmentNumber: 2,
          amount: 300000,
          dueDate: '2025-01-01',
          status: InstallmentStatus.Paid,
        },
      ]);

      const [summary] = (await service.findAll({})).items;

      expect(summary.installmentsPaid).toBe(1);
      expect(summary.overdueDays).toBe(10);
      // Pending installment: amount + interest (6% / 30 * 10 days * 300000)
      expect(summary.outstandingBalance).toBeCloseTo(306000, 0);
    });

    it('sets nextInstallmentDueDate to the oldest pending installment, whether overdue or upcoming', async () => {
      loansRepository.find.mockResolvedValue([mockLoan]);

      installmentsRepository.find.mockResolvedValue([
        {
          id: 'installment-1',
          loanId: 'loan-1',
          installmentNumber: 1,
          amount: 300000,
          dueDate: '2026-08-15',
          status: InstallmentStatus.Pending,
        },
        {
          id: 'installment-2',
          loanId: 'loan-1',
          installmentNumber: 2,
          amount: 300000,
          dueDate: '2026-09-15',
          status: InstallmentStatus.Pending,
        },
        {
          id: 'installment-3',
          loanId: 'loan-1',
          installmentNumber: 3,
          amount: 300000,
          dueDate: '2026-07-15',
          status: InstallmentStatus.Paid,
        },
      ]);

      const [summary] = (await service.findAll({})).items;

      // Oldest PENDING due date wins — the earlier Paid one (07-15) is
      // excluded even though its date is smaller.
      expect(summary.nextInstallmentDueDate).toBe('2026-08-15');
    });

    it('sets nextInstallmentDueDate to null when no installments are pending', async () => {
      loansRepository.find.mockResolvedValue([mockLoan]);

      installmentsRepository.find.mockResolvedValue([
        {
          id: 'installment-1',
          loanId: 'loan-1',
          installmentNumber: 1,
          amount: 300000,
          dueDate: '2026-07-15',
          status: InstallmentStatus.Paid,
        },
      ]);

      const [summary] = (await service.findAll({})).items;

      expect(summary.nextInstallmentDueDate).toBeNull();
    });

    it('sets overdueBalance to only the overdue installments, unlike outstandingBalance which includes upcoming ones too', async () => {
      loansRepository.find.mockResolvedValue([mockLoan]);
      const overdueDueDate = new Date();
      overdueDueDate.setDate(overdueDueDate.getDate() - 10);
      const overdueDateString = overdueDueDate.toISOString().slice(0, 10);

      const upcomingDueDate = new Date();
      upcomingDueDate.setDate(upcomingDueDate.getDate() + 20);
      const upcomingDateString = upcomingDueDate.toISOString().slice(0, 10);

      installmentsRepository.find.mockResolvedValue([
        {
          id: 'installment-1',
          loanId: 'loan-1',
          installmentNumber: 1,
          amount: 300000,
          dueDate: overdueDateString,
          status: InstallmentStatus.Pending,
        },
        {
          id: 'installment-2',
          loanId: 'loan-1',
          installmentNumber: 2,
          amount: 300000,
          dueDate: upcomingDateString,
          status: InstallmentStatus.Pending,
        },
      ]);

      const [summary] = (await service.findAll({})).items;

      // Only installment-1 (the overdue one): 300000 + interest (6% / 30 *
      // 10 days * 300000) = 306000. installment-2 is pending but NOT
      // overdue, so it's excluded here even though outstandingBalance
      // includes it.
      expect(summary.overdueBalance).toBeCloseTo(306000, 0);
      expect(summary.outstandingBalance).toBeCloseTo(606000, 0);
    });

    it('sets overdueBalance to 0 when nothing is overdue', async () => {
      loansRepository.find.mockResolvedValue([mockLoan]);

      installmentsRepository.find.mockResolvedValue([
        {
          id: 'installment-1',
          loanId: 'loan-1',
          installmentNumber: 1,
          amount: 300000,
          dueDate: '2099-01-01',
          status: InstallmentStatus.Pending,
        },
      ]);

      const [summary] = (await service.findAll({})).items;

      expect(summary.overdueBalance).toBe(0);
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

  describe('getPayments', () => {
    it('joins across every installment of the loan, oldest payment first', async () => {
      loansRepository.findOneBy.mockResolvedValue(mockLoan);
      installmentsRepository.find.mockResolvedValue([
        { id: 'installment-1' },
        { id: 'installment-2' },
      ]);
      const payments = [
        { id: 'payment-1', installmentId: 'installment-1', amountPaid: 200 },
      ];
      paymentsRepository.find.mockResolvedValue(payments);

      const result = await service.getPayments(mockLoan.id);

      expect(result).toBe(payments);
      expect(installmentsRepository.find).toHaveBeenCalledWith({
        where: { loanId: mockLoan.id },
        select: ['id'],
      });
      // Compared via the FindOperator's own _value rather than
      // toHaveBeenCalledWith(In([...])) — two separately-constructed
      // FindOperator instances aren't guaranteed comparable by deep
      // equality, so this checks what it actually filters by instead.
      const [[callArg]] = paymentsRepository.find.mock.calls as [
        [{ where: { installmentId: { _value: string[] } } }],
      ];
      expect(callArg.where.installmentId._value).toEqual([
        'installment-1',
        'installment-2',
      ]);
      expect(paymentsRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { paidAt: 'ASC' } }),
      );
    });

    it('returns an empty array without querying payments when the loan has no installments', async () => {
      loansRepository.findOneBy.mockResolvedValue(mockLoan);
      installmentsRepository.find.mockResolvedValue([]);

      const result = await service.getPayments(mockLoan.id);

      expect(result).toEqual([]);
      expect(paymentsRepository.find).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the loan does not exist', async () => {
      loansRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getPayments('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(installmentsRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('markAsPaid', () => {
    beforeEach(() => {
      loansRepository.findOneBy.mockResolvedValue({ ...mockLoan });
      loansRepository.findOne.mockResolvedValue(null); // no refinancedTo
      installmentsRepository.find.mockResolvedValue([]);
    });

    it('sets the loan to paid and every pending installment to paid', async () => {
      await service.markAsPaid(mockLoan.id);

      expect(loansRepository.update).toHaveBeenCalledWith(
        { id: mockLoan.id },
        { status: LoanStatus.Paid },
      );
      expect(installmentsRepository.update).toHaveBeenCalledWith(
        { loanId: mockLoan.id, status: InstallmentStatus.Pending },
        { status: InstallmentStatus.Paid },
      );
    });

    it('does not create any payment record', async () => {
      await service.markAsPaid(mockLoan.id);

      expect(paymentsRepository.find).not.toHaveBeenCalled();
    });

    it('rejects a loan that is already paid', async () => {
      loansRepository.findOneBy.mockResolvedValue({
        ...mockLoan,
        status: LoanStatus.Paid,
      });

      await expect(service.markAsPaid(mockLoan.id)).rejects.toThrow(
        BadRequestException,
      );
      expect(loansRepository.update).not.toHaveBeenCalled();
    });

    it('rejects a loan that has already been refinanced', async () => {
      loansRepository.findOneBy.mockResolvedValue({
        ...mockLoan,
        status: LoanStatus.Refinanced,
      });

      await expect(service.markAsPaid(mockLoan.id)).rejects.toThrow(
        BadRequestException,
      );
      expect(loansRepository.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the loan does not exist', async () => {
      loansRepository.findOneBy.mockResolvedValue(null);

      await expect(service.markAsPaid('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
