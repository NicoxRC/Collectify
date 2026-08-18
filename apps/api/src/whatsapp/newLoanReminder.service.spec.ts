import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

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
import { NewLoanReminderService } from './newLoanReminder.service';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { MessageType } from './messageType.enum';
import { WhatsAppService } from './whatsapp.service';

describe('NewLoanReminderService', () => {
  let service: NewLoanReminderService;
  let loansRepository: { findOne: jest.Mock };
  let installmentsRepository: { find: jest.Mock };
  let messageLogsRepository: { create: jest.Mock; save: jest.Mock };
  let messageLogItemsRepository: { create: jest.Mock; save: jest.Mock };
  let messageTemplatesService: { findByTypeOrThrow: jest.Mock };
  let whatsAppService: { sendTextMessage: jest.Mock };

  const mockClient: Client = {
    id: 'client-1',
    firstName: 'David',
    lastName: 'Ordoñez',
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
    client: mockClient,
    promissoryNoteNumber: '1093',
    principalAmount: 4308000,
    interestRate: 6,
    disbursedAt: '2026-05-20',
    installmentFrequency: InstallmentFrequency.Monthly,
    totalInstallments: 12,
    status: LoanStatus.Active,
    refinancedFromLoanId: null,
    refinancedFromLoan: null,
    description: 'Compra de Apple MacBook Air M5',
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

  function installment(overrides: Partial<Installment> = {}): Installment {
    return {
      id: 'inst-1',
      loanId: mockLoan.id,
      loan: mockLoan,
      installmentNumber: 1,
      amount: 359000,
      principalPortion: null,
      dueDate: '2026-06-20',
      status: InstallmentStatus.Pending,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    loansRepository = { findOne: jest.fn() };
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
        NewLoanReminderService,
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

    service = module.get<NewLoanReminderService>(NewLoanReminderService);
  });

  describe('sendNewLoanMessage', () => {
    beforeEach(() => {
      loansRepository.findOne.mockResolvedValue(mockLoan);
      installmentsRepository.find.mockResolvedValue([
        installment({ id: 'inst-1', installmentNumber: 1 }),
        installment({ id: 'inst-2', installmentNumber: 2 }),
      ]);
      messageTemplatesService.findByTypeOrThrow.mockResolvedValue({
        content:
          'Hola {{clientFullName}}, pagaré #{{promissoryNoteNumber}} por {{loanDescription}}, {{totalInstallments}} cuotas {{installmentsSummary}} desde {{disbursedAt}}',
      });
    });

    it('renders and sends the new-loan message, logging one item per installment', async () => {
      whatsAppService.sendTextMessage.mockResolvedValue(true);

      const result = await service.sendNewLoanMessage(mockLoan.id);

      expect(messageTemplatesService.findByTypeOrThrow).toHaveBeenCalledWith(
        MessageType.NewLoan,
      );
      expect(whatsAppService.sendTextMessage).toHaveBeenCalledWith(
        mockClient.phoneNumber,
        expect.stringContaining('pagaré #1093'),
      );
      expect(messageLogsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: mockClient.id,
          type: MessageType.NewLoan,
          status: MessageLogStatus.Sent,
        }),
      );
      expect(messageLogItemsRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({
          messageLogId: 'log-1',
          installmentId: 'inst-1',
          overdueDaysSnapshot: 0,
          interestSnapshot: 0,
        }),
        expect.objectContaining({
          messageLogId: 'log-1',
          installmentId: 'inst-2',
          overdueDaysSnapshot: 0,
          interestSnapshot: 0,
        }),
      ]);
      expect(result.status).toBe(MessageLogStatus.Sent);
    });

    it('logs the message as failed when WhatsAppService could not send it', async () => {
      whatsAppService.sendTextMessage.mockResolvedValue(false);

      const result = await service.sendNewLoanMessage(mockLoan.id);

      expect(result.status).toBe(MessageLogStatus.Failed);
    });

    it('throws NotFoundException when the loan does not exist', async () => {
      loansRepository.findOne.mockResolvedValue(null);

      await expect(service.sendNewLoanMessage('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
