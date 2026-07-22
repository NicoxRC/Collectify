import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { Configuration } from '../config/configuration';

import { OverdueReminderService } from './overdueReminder.service';

// Registered dynamically (not via the static @Cron() decorator) because the
// schedule is only known at runtime, from OVERDUE_REMINDER_CRON — decorator
// arguments are evaluated at class-definition time, before DI/ConfigService
// exist. This is also what makes pause/resume via SchedulerRegistry possible.
// Runs 3x/week (Mon/Wed/Fri by default) — the "weekly" in runWeeklyReminder
// refers to the message's grouping window (one consolidated message per
// client), not the cadence, which is controlled entirely by this env var.
@Injectable()
export class OverdueReminderCron implements OnModuleInit {
  static readonly JOB_NAME = 'overdueReminder';

  private readonly logger = new Logger(OverdueReminderCron.name);

  constructor(
    private readonly overdueReminderService: OverdueReminderService,
    private readonly configService: ConfigService<Configuration, true>,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const { overdueReminderExpression } = this.configService.get('cron', {
      infer: true,
    });

    const job = new CronJob(overdueReminderExpression, () => {
      void this.overdueReminderService
        .runWeeklyReminder()
        .catch((error: unknown) => {
          this.logger.error('Weekly overdue reminder job failed', error);
        });
    });

    this.schedulerRegistry.addCronJob(OverdueReminderCron.JOB_NAME, job);
    job.start();
    this.logger.log(
      `Overdue reminder cron scheduled: ${overdueReminderExpression}`,
    );
  }
}
