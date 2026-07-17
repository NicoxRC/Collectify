import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { Configuration } from '../config/configuration';

import { UpcomingDueReminderService } from './upcomingDueReminder.service';

// Registered dynamically for the same reason as OverdueReminderCron — the
// schedule is only known at runtime, from UPCOMING_DUE_REMINDER_CRON.
@Injectable()
export class UpcomingDueReminderCron implements OnModuleInit {
  static readonly JOB_NAME = 'upcomingDueReminder';

  private readonly logger = new Logger(UpcomingDueReminderCron.name);

  constructor(
    private readonly upcomingDueReminderService: UpcomingDueReminderService,
    private readonly configService: ConfigService<Configuration, true>,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const { upcomingDueReminderExpression } = this.configService.get('cron', {
      infer: true,
    });

    const job = new CronJob(upcomingDueReminderExpression, () => {
      void this.upcomingDueReminderService
        .runDailyReminder()
        .catch((error: unknown) => {
          this.logger.error('Daily upcoming-due reminder job failed', error);
        });
    });

    this.schedulerRegistry.addCronJob(UpcomingDueReminderCron.JOB_NAME, job);
    job.start();
    this.logger.log(
      `Upcoming-due reminder cron scheduled: ${upcomingDueReminderExpression}`,
    );
  }
}
