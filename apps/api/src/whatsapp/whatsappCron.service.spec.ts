import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { AccountSummaryService } from './accountSummary.service';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { MessageType } from './messageType.enum';
import { NewLoanReminderService } from './newLoanReminder.service';
import { OverdueReminderService } from './overdueReminder.service';
import { UpcomingDueReminderService } from './upcomingDueReminder.service';
import { WhatsappCronService } from './whatsappCron.service';

class FakeCronJob {
  isActive = false;
  constructor(
    readonly cronTime: string,
    readonly onTick: () => void,
  ) {}
  start = jest.fn(() => {
    this.isActive = true;
  });
  stop = jest.fn(() => {
    this.isActive = false;
  });
}

jest.mock('cron', () => ({
  CronJob: jest.fn(
    (cronTime: string, onTick: () => void) => new FakeCronJob(cronTime, onTick),
  ),
}));

describe('WhatsappCronService', () => {
  let service: WhatsappCronService;
  let overdueReminderService: { runWeeklyReminder: jest.Mock };
  let upcomingDueReminderService: { runDailyReminder: jest.Mock };
  let newLoanReminderService: { runPendingNotifications: jest.Mock };
  let accountSummaryService: { runAudienceSummaries: jest.Mock };
  let messageTemplatesService: {
    findByTypeOrThrow: jest.Mock;
    updateCronExpression: jest.Mock;
  };
  let jobs: Map<string, FakeCronJob>;
  let schedulerRegistry: {
    addCronJob: jest.Mock;
    getCronJob: jest.Mock;
    doesExist: jest.Mock;
    deleteCronJob: jest.Mock;
  };

  beforeEach(async () => {
    overdueReminderService = { runWeeklyReminder: jest.fn() };
    upcomingDueReminderService = { runDailyReminder: jest.fn() };
    newLoanReminderService = { runPendingNotifications: jest.fn() };
    accountSummaryService = { runAudienceSummaries: jest.fn() };
    messageTemplatesService = {
      findByTypeOrThrow: jest.fn().mockResolvedValue({ cronExpression: null }),
      updateCronExpression: jest.fn(),
    };

    jobs = new Map();
    schedulerRegistry = {
      addCronJob: jest.fn((name: string, job: FakeCronJob) => {
        jobs.set(name, job);
      }),
      getCronJob: jest.fn((name: string) => jobs.get(name)),
      doesExist: jest.fn((_type: string, name: string) => jobs.has(name)),
      deleteCronJob: jest.fn((name: string) => jobs.delete(name)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappCronService,
        {
          provide: OverdueReminderService,
          useValue: overdueReminderService,
        },
        {
          provide: UpcomingDueReminderService,
          useValue: upcomingDueReminderService,
        },
        { provide: NewLoanReminderService, useValue: newLoanReminderService },
        { provide: AccountSummaryService, useValue: accountSummaryService },
        {
          provide: MessageTemplatesService,
          useValue: messageTemplatesService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({
              overdueReminderExpression: '0 9 * * 1,3,5',
              upcomingDueReminderExpression: '0 8 * * *',
              newLoanReminderExpression: '0 * * * *',
              accountSummaryReminderExpression: '0 8 1 * *',
            }),
          },
        },
        { provide: SchedulerRegistry, useValue: schedulerRegistry },
      ],
    }).compile();

    service = module.get<WhatsappCronService>(WhatsappCronService);
  });

  describe('onModuleInit', () => {
    it('registers and starts one job per message type', async () => {
      await service.onModuleInit();

      expect(schedulerRegistry.addCronJob).toHaveBeenCalledTimes(4);
      for (const type of Object.values(MessageType)) {
        const job = jobs.get(WhatsappCronService.jobName(type));
        expect(job?.isActive).toBe(true);
      }
    });

    it('uses the template cronExpression when set, falling back to the code default otherwise', async () => {
      messageTemplatesService.findByTypeOrThrow.mockImplementation(
        (type: MessageType) =>
          Promise.resolve({
            cronExpression: type === MessageType.Overdue ? '0 7 * * *' : null,
          }),
      );

      await service.onModuleInit();

      const cronJobMock = CronJob as unknown as jest.Mock;
      expect(cronJobMock).toHaveBeenCalledWith(
        '0 7 * * *',
        expect.any(Function) as unknown,
      );
      expect(cronJobMock).toHaveBeenCalledWith(
        '0 * * * *',
        expect.any(Function) as unknown,
      );
    });
  });

  describe('getStatus/pause/resume', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('reports the running state', () => {
      expect(service.getStatus(MessageType.Overdue)).toEqual({
        running: true,
      });
    });

    it('pauses a job', async () => {
      await service.pause(MessageType.Overdue);

      expect(service.getStatus(MessageType.Overdue)).toEqual({
        running: false,
      });
    });

    it('resumes a paused job', async () => {
      await service.pause(MessageType.Overdue);

      service.resume(MessageType.Overdue);

      expect(service.getStatus(MessageType.Overdue)).toEqual({
        running: true,
      });
    });
  });

  describe('reschedule', () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it('persists the new expression and replaces the running job', async () => {
      messageTemplatesService.updateCronExpression.mockResolvedValue({
        type: MessageType.Overdue,
        cronExpression: '0 10 * * *',
      });

      const result = await service.reschedule(
        MessageType.Overdue,
        '0 10 * * *',
      );

      expect(messageTemplatesService.updateCronExpression).toHaveBeenCalledWith(
        MessageType.Overdue,
        '0 10 * * *',
      );
      expect(result.cronExpression).toBe('0 10 * * *');
      expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
        WhatsappCronService.jobName(MessageType.Overdue),
      );
      expect(service.getStatus(MessageType.Overdue)).toEqual({
        running: true,
      });
    });
  });

  describe('cron job execution', () => {
    it('invokes runWeeklyReminder when the overdue job ticks', async () => {
      await service.onModuleInit();
      const job = jobs.get(WhatsappCronService.jobName(MessageType.Overdue));
      overdueReminderService.runWeeklyReminder.mockResolvedValue(undefined);

      job?.onTick();

      expect(overdueReminderService.runWeeklyReminder).toHaveBeenCalled();
    });
  });
});
