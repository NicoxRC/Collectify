import { BadRequestException, NotFoundException } from '@nestjs/common';
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
import { MessageFrequencyThrottleService } from './messageFrequencyThrottle.service';
import { MessageType } from './messageType.enum';
import { OverdueReminderService } from './overdueReminder.service';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { WhatsAppService } from './whatsapp.service';

describe('OverdueReminderService', () => {
  let service: OverdueReminderService;
  let clientsRepository: { findOneBy: jest.Mock };
  let installmentsRepository: { find: jest.Mock };
  let messageLogsRepository: { create: jest.Mock; save: jest.Mock };
  let messageLogItemsRepository: { create: jest.Mock; save: jest.Mock };
  let messageTemplatesService: { findByTypeOrThrow: jest.Mock };
  let messageFrequencyThrottleService: { filterOutThrottledClients: jest.Mock };
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
    promissoryNoteNumber: '#743',
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
    newLoanMessageSentAt: null,
    coDebtorClientId: null,
    coDebtorClient: null,
    coDebtorRelationship: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  function overdueInstallment(
    overrides: Partial<Installment> = {},
  ): Installment {
    return {
      id: 'inst-1',
      loanId: mockLoan.id,
      loan: mockLoan,
      installmentNumber: 1,
      amount: 210000,
      principalPortion: null,
      dueDate: '2024-01-01',
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
    // Default: no throttling — passes every dynamically-qualifying client
    // straight through, matching "no whitelist entries" behavior.
    messageFrequencyThrottleService = {
      filterOutThrottledClients: jest
        .fn()
        .mockImplementation((ids: string[]) => Promise.resolve(ids)),
    };
    whatsAppService = { sendTextMessage: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OverdueReminderService,
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
          provide: MessageFrequencyThrottleService,
          useValue: messageFrequencyThrottleService,
        },
        { provide: WhatsAppService, useValue: whatsAppService },
      ],
    }).compile();

    service = module.get<OverdueReminderService>(OverdueReminderService);
  });

  describe('sendReminderForClient', () => {
    beforeEach(() => {
      clientsRepository.findOneBy.mockResolvedValue(mockClient);
      messageTemplatesService.findByTypeOrThrow.mockResolvedValue({
        content:
          'Hola {{clientFullName}}\n{{installmentsList}}\nTotal: {{grandTotal}}',
      });
    });

    it('gathers overdue installments across multiple loans into one message', async () => {
      const otherLoan: Loan = {
        ...mockLoan,
        id: 'loan-2',
        promissoryNoteNumber: '#959',
      };
      installmentsRepository.find.mockResolvedValue([
        overdueInstallment({
          id: 'inst-1',
          loan: mockLoan,
          dueDate: '2024-01-01',
        }),
        overdueInstallment({
          id: 'inst-2',
          loan: otherLoan,
          dueDate: '2024-02-01',
        }),
      ]);
      whatsAppService.sendTextMessage.mockResolvedValue(true);

      const result = await service.sendReminderForClient(mockClient.id);

      expect(whatsAppService.sendTextMessage).toHaveBeenCalledWith(
        mockClient.phoneNumber,
        expect.stringContaining('#743'),
      );
      expect(whatsAppService.sendTextMessage).toHaveBeenCalledWith(
        mockClient.phoneNumber,
        expect.stringContaining('#959'),
      );
      expect(messageLogsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: MessageLogStatus.Sent,
          clientId: mockClient.id,
        }),
      );
      expect(messageLogItemsRepository.save).toHaveBeenCalledWith([
        expect.objectContaining({
          messageLogId: 'log-1',
          installmentId: 'inst-1',
        }),
        expect.objectContaining({
          messageLogId: 'log-1',
          installmentId: 'inst-2',
        }),
      ]);
      expect(result.status).toBe(MessageLogStatus.Sent);
    });

    it('logs the message as failed when WhatsAppService could not send it', async () => {
      installmentsRepository.find.mockResolvedValue([overdueInstallment()]);
      whatsAppService.sendTextMessage.mockResolvedValue(false);

      const result = await service.sendReminderForClient(mockClient.id);

      expect(result.status).toBe(MessageLogStatus.Failed);
    });

    it('throws NotFoundException when the client does not exist', async () => {
      clientsRepository.findOneBy.mockResolvedValue(null);

      await expect(service.sendReminderForClient('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the client has no overdue installments', async () => {
      installmentsRepository.find.mockResolvedValue([]);

      await expect(
        service.sendReminderForClient(mockClient.id),
      ).rejects.toThrow(BadRequestException);
      expect(whatsAppService.sendTextMessage).not.toHaveBeenCalled();
    });

    it('sends an empty/$0 message instead of throwing when allowEmpty is true', async () => {
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

  describe('runWeeklyReminder', () => {
    // Phase 27 reverses Phase 18's "audience is a required filter" design
    // (docs/phases/PHASE_27_MESSAGE_FREQUENCY.md): every dynamically-
    // qualifying client is messaged again, with no group to populate
    // first — no audience/whitelist involved at all in this case.
    it('sends a reminder to every dynamically-overdue client with no whitelist involved', async () => {
      installmentsRepository.find.mockResolvedValue([
        overdueInstallment({ loan: { ...mockLoan, clientId: 'client-1' } }),
        overdueInstallment({ loan: { ...mockLoan, clientId: 'client-2' } }),
      ]);
      const sendSpy = jest
        .spyOn(service, 'sendReminderForClient')
        .mockResolvedValue({} as MessageLog);

      await service.runWeeklyReminder();

      expect(sendSpy).toHaveBeenCalledWith('client-1');
      expect(sendSpy).toHaveBeenCalledWith('client-2');
    });

    it('passes the dynamically-overdue client ids through the frequency throttle before sending', async () => {
      installmentsRepository.find.mockResolvedValue([
        overdueInstallment({ loan: { ...mockLoan, clientId: 'client-1' } }),
        overdueInstallment({ loan: { ...mockLoan, clientId: 'client-2' } }),
      ]);
      jest
        .spyOn(service, 'sendReminderForClient')
        .mockResolvedValue({} as MessageLog);

      await service.runWeeklyReminder();

      expect(
        messageFrequencyThrottleService.filterOutThrottledClients,
      ).toHaveBeenCalledWith(['client-1', 'client-2'], MessageType.Overdue);
    });

    it('only sends to the clients the frequency throttle actually returns', async () => {
      installmentsRepository.find.mockResolvedValue([
        overdueInstallment({ loan: { ...mockLoan, clientId: 'client-1' } }),
        overdueInstallment({ loan: { ...mockLoan, clientId: 'client-2' } }),
      ]);
      messageFrequencyThrottleService.filterOutThrottledClients.mockResolvedValue(
        ['client-1'],
      );
      const sendSpy = jest
        .spyOn(service, 'sendReminderForClient')
        .mockResolvedValue({} as MessageLog);

      await service.runWeeklyReminder();

      expect(sendSpy).toHaveBeenCalledTimes(1);
      expect(sendSpy).toHaveBeenCalledWith('client-1');
    });

    it('continues with the next client when one fails', async () => {
      installmentsRepository.find.mockResolvedValue([
        overdueInstallment({ loan: { ...mockLoan, clientId: 'client-1' } }),
        overdueInstallment({ loan: { ...mockLoan, clientId: 'client-2' } }),
      ]);
      const sendSpy = jest
        .spyOn(service, 'sendReminderForClient')
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({} as MessageLog);

      await expect(service.runWeeklyReminder()).resolves.toBeUndefined();
      expect(sendSpy).toHaveBeenCalledTimes(2);
    });
  });
});
