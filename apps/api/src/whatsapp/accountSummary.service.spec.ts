import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AccountSummaryService } from './accountSummary.service';
import { Client } from '../clients/entities/client.entity';
import {
  Installment,
  InstallmentStatus,
} from '../loans/entities/installment.entity';
import {
  InstallmentFrequency,
  Loan,
  LoanStatus,
} from '../loans/entities/loan.entity';

import { MessageLog, MessageLogStatus } from './entities/messageLog.entity';
import { MessageLogItem } from './entities/messageLogItem.entity';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { MessageType } from './messageType.enum';
import { WhatsAppService } from './whatsapp.service';

describe('AccountSummaryService', () => {
  let service: AccountSummaryService;
  let clientsRepository: { findOneBy: jest.Mock };
  let loansRepository: { find: jest.Mock };
  let installmentsRepository: { find: jest.Mock };
  let messageLogsRepository: { create: jest.Mock; save: jest.Mock };
  let messageLogItemsRepository: { create: jest.Mock; save: jest.Mock };
  let messageTemplatesService: { findByTypeOrThrow: jest.Mock };
  let whatsAppService: { sendTextMessage: jest.Mock };

  const mockClient: Client = {
    id: 'client-1',
    firstName: 'Juana',
    lastName: 'Pérez',
    documentNumber: '1234567890',
    phoneNumber: '+573001234567',
    creditLimit: null,
    documentType: null,
    dateOfBirth: null,
    documentIssuePlace: null,
    email: null,
    alternatePhoneNumber: null,
    homeAddress: null,
    workAddress: null,
    neighborhood: null,
    city: null,
    occupation: null,
    employerName: null,
    monthlyIncome: null,
    idDocumentFrontUrl: null,
    idDocumentBackUrl: null,
    selfieImageUrl: null,
    dataProcessingConsent: false,
    consentGivenAt: null,
    consentDocumentUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockLoan: Loan = {
    id: 'loan-1',
    clientId: mockClient.id,
    client: undefined as never,
    promissoryNoteNumber: '743',
    principalAmount: 900000,
    interestRate: 6,
    disbursedAt: '2024-01-01',
    installmentFrequency: InstallmentFrequency.Monthly,
    totalInstallments: 3,
    status: LoanStatus.Active,
    refinancedFromLoanId: null,
    refinancedFromLoan: null,
    description: null,
    initialPayment: null,
    usuryCeilingExceededAtCreation: false,
    usuryJustification: null,
    newLoanMessageSentAt: null,
    coDebtorFullName: null,
    coDebtorDocumentType: null,
    coDebtorDocumentNumber: null,
    coDebtorPhoneNumber: null,
    coDebtorAddress: null,
    coDebtorRelationship: null,
    coDebtorIdDocumentUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  function pendingInstallment(
    overrides: Partial<Installment> = {},
  ): Installment {
    return {
      id: 'inst-1',
      loanId: mockLoan.id,
      loan: mockLoan,
      installmentNumber: 1,
      amount: 300000,
      principalPortion: null,
      dueDate: '2099-01-01', // far future by default — not overdue
      status: InstallmentStatus.Pending,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    clientsRepository = { findOneBy: jest.fn() };
    loansRepository = { find: jest.fn() };
    installmentsRepository = { find: jest.fn() };
    messageLogsRepository = {
      create: jest.fn((dto: Partial<MessageLog>) => dto),
      save: jest.fn((log: Partial<MessageLog>) =>
        Promise.resolve({ id: 'log-1', ...log }),
      ),
    };
    messageLogItemsRepository = {
      create: jest.fn((dto: Partial<MessageLogItem>) => dto),
      save: jest.fn((items: unknown[]) => Promise.resolve(items)),
    };
    messageTemplatesService = { findByTypeOrThrow: jest.fn() };
    whatsAppService = { sendTextMessage: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountSummaryService,
        { provide: getRepositoryToken(Client), useValue: clientsRepository },
        { provide: getRepositoryToken(Loan), useValue: loansRepository },
        {
          provide: getRepositoryToken(Installment),
          useValue: installmentsRepository,
        },
        {
          provide: getRepositoryToken(MessageLog),
          useValue: messageLogsRepository,
        },
        {
          provide: getRepositoryToken(MessageLogItem),
          useValue: messageLogItemsRepository,
        },
        { provide: MessageTemplatesService, useValue: messageTemplatesService },
        { provide: WhatsAppService, useValue: whatsAppService },
      ],
    }).compile();

    service = module.get<AccountSummaryService>(AccountSummaryService);
  });

  describe('sendAccountSummary', () => {
    beforeEach(() => {
      clientsRepository.findOneBy.mockResolvedValue(mockClient);
      messageTemplatesService.findByTypeOrThrow.mockResolvedValue({
        content:
          'Hola {{clientFullName}}\n{{installmentsList}}\nTotal: {{grandTotal}}',
      });
    });

    it('includes both overdue and not-yet-due installments in one message', async () => {
      installmentsRepository.find.mockResolvedValue([
        pendingInstallment({
          id: 'inst-overdue',
          dueDate: '2020-01-01', // far past — overdue
        }),
        pendingInstallment({
          id: 'inst-future',
          installmentNumber: 2,
          dueDate: '2099-01-01', // far future — not overdue
        }),
      ]);
      whatsAppService.sendTextMessage.mockResolvedValue(true);

      const result = await service.sendAccountSummary(mockClient.id);

      expect(messageTemplatesService.findByTypeOrThrow).toHaveBeenCalledWith(
        MessageType.AccountSummary,
      );
      expect(whatsAppService.sendTextMessage).toHaveBeenCalledWith(
        mockClient.phoneNumber,
        expect.stringContaining('venció hace'),
      );
      expect(whatsAppService.sendTextMessage).toHaveBeenCalledWith(
        mockClient.phoneNumber,
        expect.stringContaining('vence en'),
      );
      expect(messageLogsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.AccountSummary,
          status: MessageLogStatus.Sent,
        }),
      );
      expect(messageLogItemsRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({ installmentId: 'inst-overdue' }),
        expect.objectContaining({ installmentId: 'inst-future' }),
      ]);
      expect(result.status).toBe(MessageLogStatus.Sent);
    });

    it('throws NotFoundException when the client does not exist', async () => {
      clientsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.sendAccountSummary('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the client has no pending installments', async () => {
      installmentsRepository.find.mockResolvedValue([]);

      await expect(service.sendAccountSummary(mockClient.id)).rejects.toThrow(
        BadRequestException,
      );
      expect(whatsAppService.sendTextMessage).not.toHaveBeenCalled();
    });

    it('sends an empty/$0 message instead of throwing when allowEmpty is true', async () => {
      installmentsRepository.find.mockResolvedValue([]);
      whatsAppService.sendTextMessage.mockResolvedValue(true);

      const result = await service.sendAccountSummary(mockClient.id, {
        allowEmpty: true,
      });

      expect(whatsAppService.sendTextMessage).toHaveBeenCalled();
      expect(result.status).toBe(MessageLogStatus.Sent);
      expect(messageLogItemsRepository.save).toHaveBeenCalledWith([]);
    });
  });

  // Confirmed with the human (2026-08-18), replacing the original
  // audience-only design: every client with at least one active loan gets
  // a summary — no curated audience involved.
  describe('runActiveClientSummaries', () => {
    it('sends to every client with an active loan, with allowEmpty', async () => {
      loansRepository.find.mockResolvedValue([
        { clientId: 'client-1' },
        { clientId: 'client-2' },
      ]);
      const sendSpy = jest
        .spyOn(service, 'sendAccountSummary')
        .mockResolvedValue({} as MessageLog);

      await service.runActiveClientSummaries();

      expect(loansRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: LoanStatus.Active },
        }),
      );
      expect(sendSpy).toHaveBeenCalledWith('client-1', { allowEmpty: true });
      expect(sendSpy).toHaveBeenCalledWith('client-2', { allowEmpty: true });
    });

    it('deduplicates a client with multiple active loans', async () => {
      loansRepository.find.mockResolvedValue([
        { clientId: 'client-1' },
        { clientId: 'client-1' },
      ]);
      const sendSpy = jest
        .spyOn(service, 'sendAccountSummary')
        .mockResolvedValue({} as MessageLog);

      await service.runActiveClientSummaries();

      expect(sendSpy).toHaveBeenCalledTimes(1);
    });

    it('continues with the next client when one fails', async () => {
      loansRepository.find.mockResolvedValue([
        { clientId: 'client-1' },
        { clientId: 'client-2' },
      ]);
      const sendSpy = jest
        .spyOn(service, 'sendAccountSummary')
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({} as MessageLog);

      await expect(service.runActiveClientSummaries()).resolves.toBeUndefined();
      expect(sendSpy).toHaveBeenCalledTimes(2);
    });
  });
});
