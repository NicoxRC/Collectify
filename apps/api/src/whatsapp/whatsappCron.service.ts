import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { Configuration } from '../config/configuration';

import { AccountSummaryService } from './accountSummary.service';
import { MessageTemplate } from './entities/messageTemplate.entity';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { MessageType } from './messageType.enum';
import { NewLoanReminderService } from './newLoanReminder.service';
import { OverdueReminderService } from './overdueReminder.service';
import { UpcomingDueReminderService } from './upcomingDueReminder.service';

// Replaces OverdueReminderCron/UpcomingDueReminderCron (Phase 18) — one
// dynamically-registered job per MessageType, sharing a single
// pause/resume/status/reschedule mechanism via SchedulerRegistry instead of
// copy-pasted per-type boilerplate. All 4 message types get a cron now
// (confirmed with the human — see docs/phases/PHASE_18_MESSAGE_AUDIENCES.md).
// Each job's schedule comes from MessageTemplate.cronExpression (DB,
// admin-editable) when set, falling back to the code-level default from
// ConfigService.
@Injectable()
export class WhatsappCronService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappCronService.name);

  constructor(
    private readonly overdueReminderService: OverdueReminderService,
    private readonly upcomingDueReminderService: UpcomingDueReminderService,
    private readonly newLoanReminderService: NewLoanReminderService,
    private readonly accountSummaryService: AccountSummaryService,
    private readonly messageTemplatesService: MessageTemplatesService,
    private readonly configService: ConfigService<Configuration, true>,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  static jobName(type: MessageType): string {
    return `whatsappCron:${type}`;
  }

  async onModuleInit(): Promise<void> {
    for (const type of Object.values(MessageType)) {
      const expression = await this.resolveExpression(type);
      this.registerJob(type, expression);
    }
  }

  getStatus(type: MessageType): { running: boolean } {
    const job = this.schedulerRegistry.getCronJob(
      WhatsappCronService.jobName(type),
    );
    // The `cron` package's CronJob exposes this as `isActive` (a getter),
    // not `running`.
    return { running: job.isActive };
  }

  async pause(type: MessageType): Promise<{ paused: true }> {
    await this.schedulerRegistry
      .getCronJob(WhatsappCronService.jobName(type))
      .stop();
    return { paused: true };
  }

  resume(type: MessageType): { paused: false } {
    this.schedulerRegistry
      .getCronJob(WhatsappCronService.jobName(type))
      .start();
    return { paused: false };
  }

  async reschedule(
    type: MessageType,
    cronExpression: string,
  ): Promise<MessageTemplate> {
    const template = await this.messageTemplatesService.updateCronExpression(
      type,
      cronExpression,
    );
    this.registerJob(type, cronExpression);
    return template;
  }

  private async resolveExpression(type: MessageType): Promise<string> {
    const template = await this.messageTemplatesService.findByTypeOrThrow(type);
    return template.cronExpression ?? this.defaultExpression(type);
  }

  private defaultExpression(type: MessageType): string {
    const {
      overdueReminderExpression,
      upcomingDueReminderExpression,
      newLoanReminderExpression,
      accountSummaryReminderExpression,
    } = this.configService.get('cron', { infer: true });

    switch (type) {
      case MessageType.Overdue:
        return overdueReminderExpression;
      case MessageType.UpcomingDue:
        return upcomingDueReminderExpression;
      case MessageType.NewLoan:
        return newLoanReminderExpression;
      case MessageType.AccountSummary:
        return accountSummaryReminderExpression;
    }
  }

  private runFor(type: MessageType): Promise<void> {
    switch (type) {
      case MessageType.Overdue:
        return this.overdueReminderService.runWeeklyReminder();
      case MessageType.UpcomingDue:
        return this.upcomingDueReminderService.runDailyReminder();
      case MessageType.NewLoan:
        return this.newLoanReminderService.runPendingNotifications();
      case MessageType.AccountSummary:
        return this.accountSummaryService.runAudienceSummaries();
    }
  }

  // Registering over an existing job name replaces it — used both at boot
  // and by reschedule(), so a schedule change takes effect without a
  // restart.
  private registerJob(type: MessageType, expression: string): void {
    const jobName = WhatsappCronService.jobName(type);
    if (this.schedulerRegistry.doesExist('cron', jobName)) {
      this.schedulerRegistry.deleteCronJob(jobName);
    }

    const job = new CronJob(expression, () => {
      void this.runFor(type).catch((error: unknown) => {
        this.logger.error(`${type} cron job failed`, error);
      });
    });

    this.schedulerRegistry.addCronJob(jobName, job);
    job.start();
    this.logger.log(`${type} cron scheduled: ${expression}`);
  }
}
