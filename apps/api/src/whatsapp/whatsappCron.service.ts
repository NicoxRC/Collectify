import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { Configuration } from '../config/configuration';

import { AccountSummaryService } from './accountSummary.service';
import { MessageTemplate } from './entities/messageTemplate.entity';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { MessageType } from './messageType.enum';
import { OverdueReminderService } from './overdueReminder.service';
import { UpcomingDueReminderService } from './upcomingDueReminder.service';

// Replaces OverdueReminderCron/UpcomingDueReminderCron (Phase 18) — one
// dynamically-registered job per MessageType, sharing a single
// pause/resume/status/reschedule mechanism via SchedulerRegistry instead of
// copy-pasted per-type boilerplate.
//
// `new_loan` does NOT get a cron job (corrected after client QA,
// 2026-08-18 — Phase 18 originally gave all 4 types one): it's sent
// exactly once, synchronously, at loan creation — see
// NewLoanReminderService and docs/phases/PHASE_18_MESSAGE_AUDIENCES.md
// "Extended after client QA". `overdue`/`upcoming_due`/`account_summary`
// each still get a schedule, sourced from MessageTemplate.cronExpression
// (DB, admin-editable) when set, falling back to the code-level default
// from ConfigService.
const CRON_SUPPORTED_TYPES = [
  MessageType.Overdue,
  MessageType.UpcomingDue,
  MessageType.AccountSummary,
] as const;

@Injectable()
export class WhatsappCronService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappCronService.name);

  constructor(
    private readonly overdueReminderService: OverdueReminderService,
    private readonly upcomingDueReminderService: UpcomingDueReminderService,
    private readonly accountSummaryService: AccountSummaryService,
    private readonly messageTemplatesService: MessageTemplatesService,
    private readonly configService: ConfigService<Configuration, true>,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  static jobName(type: MessageType): string {
    return `whatsappCron:${type}`;
  }

  async onModuleInit(): Promise<void> {
    for (const type of CRON_SUPPORTED_TYPES) {
      const expression = await this.resolveExpression(type);
      this.registerJob(type, expression);
    }
  }

  getStatus(type: MessageType): { running: boolean } {
    this.assertCronSupported(type);
    const job = this.schedulerRegistry.getCronJob(
      WhatsappCronService.jobName(type),
    );
    // The `cron` package's CronJob exposes this as `isActive` (a getter),
    // not `running`.
    return { running: job.isActive };
  }

  async pause(type: MessageType): Promise<{ paused: true }> {
    this.assertCronSupported(type);
    await this.schedulerRegistry
      .getCronJob(WhatsappCronService.jobName(type))
      .stop();
    return { paused: true };
  }

  resume(type: MessageType): { paused: false } {
    this.assertCronSupported(type);
    this.schedulerRegistry
      .getCronJob(WhatsappCronService.jobName(type))
      .start();
    return { paused: false };
  }

  async reschedule(
    type: MessageType,
    cronExpression: string,
  ): Promise<MessageTemplate> {
    this.assertCronSupported(type);
    const template = await this.messageTemplatesService.updateCronExpression(
      type,
      cronExpression,
    );
    this.registerJob(type, cronExpression);
    return template;
  }

  private assertCronSupported(type: MessageType): void {
    if (type === MessageType.NewLoan) {
      throw new BadRequestException(
        "new_loan has no cron job — it's sent synchronously right when a loan is created, with no periodic schedule or retry sweep. See docs/phases/PHASE_18_MESSAGE_AUDIENCES.md.",
      );
    }
  }

  private async resolveExpression(type: MessageType): Promise<string> {
    const template = await this.messageTemplatesService.findByTypeOrThrow(type);
    return template.cronExpression ?? this.defaultExpression(type);
  }

  private defaultExpression(type: MessageType): string {
    const {
      overdueReminderExpression,
      upcomingDueReminderExpression,
      accountSummaryReminderExpression,
    } = this.configService.get('cron', { infer: true });

    switch (type) {
      case MessageType.Overdue:
        return overdueReminderExpression;
      case MessageType.UpcomingDue:
        return upcomingDueReminderExpression;
      case MessageType.AccountSummary:
        return accountSummaryReminderExpression;
      default:
        throw new Error(`${type} has no cron job — see assertCronSupported`);
    }
  }

  private runFor(type: MessageType): Promise<void> {
    switch (type) {
      case MessageType.Overdue:
        return this.overdueReminderService.runWeeklyReminder();
      case MessageType.UpcomingDue:
        return this.upcomingDueReminderService.runDailyReminder();
      case MessageType.AccountSummary:
        return this.accountSummaryService.runActiveClientSummaries();
      default:
        throw new Error(`${type} has no cron job — see assertCronSupported`);
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
