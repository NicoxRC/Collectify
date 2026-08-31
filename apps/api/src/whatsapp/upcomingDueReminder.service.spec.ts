import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { MessageAudiencesService } from './messageAudiences/messageAudiences.service';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { MessageType } from './messageType.enum';
import { UpcomingDueReminderService } from './upcomingDueReminder.service';
import { WhatsAppService } from './whatsapp.service';

describe('UpcomingDueReminderService', () => {
  let service: UpcomingDueReminderService;
  let clientsRepository: { findOneBy: jest.Mock };
  let installmentsRepository: { find: jest.Mock };
  let messageLogsRepository: { create: jest.Mock; save: jest.Mock };
  let messageLogItemsRepository: { create: jest.Mock; save: jest.Mock };
  let messageTemplatesService: { findByTypeOrThrow: jest.Mock };
  let messageAudiencesService: { getClientIdsForTemplateType: jest.Mock };
  let whatsAppService: { sendTextMessage: jest.Mock };

  const mockClient: Client = {
    id: 'client-1',
    firstName: 'Luis',
    lastName: 'Rosales',
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
    promissoryNoteNumber: '957',
    principalAmount: 900000,
    interestRate: 6,
    disbursedAt: '2024-01-01',
    installmentFrequency: InstallmentFrequency.Monthly,
    totalInstallments: 6,
    status: LoanStatus.Active,
    refinancedFromLoanId: null,
    refinancedFromLoan: null,
    description: null,
    initialPayment: null,
    newLoanMessageSentAt: null,
    coDebtorClientId: null,
    coDebtorClient: null,
    coDebtorRelationship: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  function upcomingInstallment(
    overrides: Partial<Installment> = {},
  ): Installment {
    return {
      id: 'inst-1',
      loanId: mockLoan.id,
      loan: mockLoan,
      installmentNumber: 6,
      amount: 299000,
      principalPortion: null,
      dueDate: '2026-07-21',
      status: InstallmentStatus.Pending,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    clientsRepository = { findOneBy: jest.fn() };
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
    messageAudiencesService = {
      getClientIdsForTemplateType: jest.fn().mockResolvedValue([]),
    };
    whatsAppService = { sendTextMessage: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpcomingDueReminderService,
        { provide: getRepositoryToken(Client), useValue: clientsRepository },
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
        {
          provide: MessageAudiencesService,
          useValue: messageAudiencesService,
        },
        { provide: WhatsAppService, useValue: whatsAppService },
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockReturnValue({ upcomingDueReminderDays: [5, 3, 1] }),
          },
        },
      ],
    }).compile();

    service = module.get<UpcomingDueReminderService>(
      UpcomingDueReminderService,
    );
  });

  describe('sendReminderForClient', () => {
    beforeEach(() => {
      clientsRepository.findOneBy.mockResolvedValue(mockClient);
      messageTemplatesService.findByTypeOrThrow.mockResolvedValue({
        content: 'Hola {{clientFullName}}\n{{installmentsList}}',
      });
    });

    it('gathers upcoming installments across multiple loans into one message', async () => {
      const otherLoan: Loan = {
        ...mockLoan,
        id: 'loan-2',
        promissoryNoteNumber: '1035',
      };
      installmentsRepository.find.mockResolvedValue([
        upcomingInstallment({ id: 'inst-1', loan: mockLoan }),
        upcomingInstallment({
          id: 'inst-2',
          loan: otherLoan,
          installmentNumber: 4,
        }),
      ]);
      whatsAppService.sendTextMessage.mockResolvedValue(true);

      const result = await service.sendReminderForClient(mockClient.id);

      expect(messageTemplatesService.findByTypeOrThrow).toHaveBeenCalledWith(
        MessageType.UpcomingDue,
      );
      expect(whatsAppService.sendTextMessage).toHaveBeenCalledWith(
        mockClient.phoneNumber,
        expect.stringContaining('957'),
      );
      expect(messageLogsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: MessageType.UpcomingDue,
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

    it('throws NotFoundException when the client does not exist', async () => {
      clientsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.sendReminderForClient('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the client has no upcoming installments', async () => {
      installmentsRepository.find.mockResolvedValue([]);

      await expect(
        service.sendReminderForClient(mockClient.id),
      ).rejects.toThrow(BadRequestException);
      expect(whatsAppService.sendTextMessage).not.toHaveBeenCalled();
    });

    it('sends an empty message instead of throwing when allowEmpty is true', async () => {
      installmentsRepository.find.mockResolvedValue([]);
      whatsAppService.sendTextMessage.mockResolvedValue(true);

      const result = await service.sendReminderForClient(mockClient.id, {
        allowEmpty: true,
      });

      expect(whatsAppService.sendTextMessage).toHaveBeenCalled();
      expect(result.status).toBe(MessageLogStatus.Sent);
      expect(messageLogItemsRepository.save).toHaveBeenCalledWith([]);
    });
  });

  describe('runDailyReminder', () => {
    // Confirmed with the human (2026-08-18), reopening the original
    // additive/union design: the audience is now a required filter — a
    // client is only reminded when they're both dynamically approaching
    // due AND a member of the audience.
    it('sends a reminder only to clients who are both upcoming and in the audience', async () => {
      installmentsRepository.find.mockResolvedValue([
        upcomingInstallment({ loan: { ...mockLoan, clientId: 'client-1' } }),
        upcomingInstallment({ loan: { ...mockLoan, clientId: 'client-2' } }),
      ]);
      messageAudiencesService.getClientIdsForTemplateType.mockResolvedValue([
        'client-1',
        'client-2',
      ]);
      const sendSpy = jest
        .spyOn(service, 'sendReminderForClient')
        .mockResolvedValue({} as MessageLog);

      await service.runDailyReminder();

      expect(sendSpy).toHaveBeenCalledWith('client-1');
      expect(sendSpy).toHaveBeenCalledWith('client-2');
    });

    it('excludes an upcoming client who is not in the audience', async () => {
      installmentsRepository.find.mockResolvedValue([
        upcomingInstallment({ loan: { ...mockLoan, clientId: 'client-1' } }),
        upcomingInstallment({ loan: { ...mockLoan, clientId: 'client-2' } }),
      ]);
      messageAudiencesService.getClientIdsForTemplateType.mockResolvedValue([
        'client-1',
      ]);
      const sendSpy = jest
        .spyOn(service, 'sendReminderForClient')
        .mockResolvedValue({} as MessageLog);

      await service.runDailyReminder();

      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith('client-1');
    });

    it('does not notify an audience member who has nothing upcoming', async () => {
      installmentsRepository.find.mockResolvedValue([
        upcomingInstallment({ loan: { ...mockLoan, clientId: 'client-1' } }),
      ]);
      messageAudiencesService.getClientIdsForTemplateType.mockResolvedValue([
        'client-1',
        'client-3',
      ]);
      const sendSpy = jest
        .spyOn(service, 'sendReminderForClient')
        .mockResolvedValue({} as MessageLog);

      await service.runDailyReminder();

      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith('client-1');
    });

    it('notifies nobody when the audience is empty, even with upcoming clients', async () => {
      installmentsRepository.find.mockResolvedValue([
        upcomingInstallment({ loan: { ...mockLoan, clientId: 'client-1' } }),
      ]);
      messageAudiencesService.getClientIdsForTemplateType.mockResolvedValue([]);
      const sendSpy = jest
        .spyOn(service, 'sendReminderForClient')
        .mockResolvedValue({} as MessageLog);

      await service.runDailyReminder();

      expect(sendSpy).not.toHaveBeenCalled();
    });

    it('continues with the next client when one fails', async () => {
      installmentsRepository.find.mockResolvedValue([
        upcomingInstallment({ loan: { ...mockLoan, clientId: 'client-1' } }),
        upcomingInstallment({ loan: { ...mockLoan, clientId: 'client-2' } }),
      ]);
      messageAudiencesService.getClientIdsForTemplateType.mockResolvedValue([
        'client-1',
        'client-2',
      ]);
      const sendSpy = jest
        .spyOn(service, 'sendReminderForClient')
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({} as MessageLog);

      await expect(service.runDailyReminder()).resolves.toBeUndefined();
      expect(sendSpy).toHaveBeenCalledTimes(2);
    });
  });
});
