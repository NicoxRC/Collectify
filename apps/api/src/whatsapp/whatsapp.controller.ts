import { Controller, Param, Post } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

import { AccountSummaryService } from './accountSummary.service';
import { MessageLog } from './entities/messageLog.entity';
import { OverdueReminderCron } from './overdueReminder.cron';
import { OverdueReminderService } from './overdueReminder.service';
import { UpcomingDueReminderCron } from './upcomingDueReminder.cron';
import { UpcomingDueReminderService } from './upcomingDueReminder.service';

@ApiTags('whatsapp')
@ApiBearerAuth()
@Roles(UserRole.Admin)
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly overdueReminderService: OverdueReminderService,
    private readonly upcomingDueReminderService: UpcomingDueReminderService,
    private readonly accountSummaryService: AccountSummaryService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  @Post('cron/pause')
  @ApiOperation({
    summary: 'Pause the weekly overdue reminder job (admin only)',
  })
  @ApiResponse({ status: 200, description: 'The job is paused.' })
  async pauseCron(): Promise<{ paused: true }> {
    await this.schedulerRegistry
      .getCronJob(OverdueReminderCron.JOB_NAME)
      .stop();
    return { paused: true };
  }

  @Post('cron/resume')
  @ApiOperation({
    summary: 'Resume the weekly overdue reminder job (admin only)',
  })
  @ApiResponse({ status: 200, description: 'The job is running again.' })
  resumeCron(): { paused: false } {
    this.schedulerRegistry.getCronJob(OverdueReminderCron.JOB_NAME).start();
    return { paused: false };
  }

  @Post('cron/upcoming-due/pause')
  @ApiOperation({
    summary: 'Pause the daily upcoming-due reminder job (admin only)',
  })
  @ApiResponse({ status: 200, description: 'The job is paused.' })
  async pauseUpcomingDueCron(): Promise<{ paused: true }> {
    await this.schedulerRegistry
      .getCronJob(UpcomingDueReminderCron.JOB_NAME)
      .stop();
    return { paused: true };
  }

  @Post('cron/upcoming-due/resume')
  @ApiOperation({
    summary: 'Resume the daily upcoming-due reminder job (admin only)',
  })
  @ApiResponse({ status: 200, description: 'The job is running again.' })
  resumeUpcomingDueCron(): { paused: false } {
    this.schedulerRegistry.getCronJob(UpcomingDueReminderCron.JOB_NAME).start();
    return { paused: false };
  }

  @Post('clients/:clientId/send-reminder')
  @ApiOperation({
    summary:
      'Manually trigger the overdue reminder for one client (admin only)',
    description:
      'Same grouping/rendering logic as the weekly job, triggered on demand.',
  })
  @ApiResponse({ status: 201, description: 'Returns the created message log.' })
  @ApiResponse({
    status: 400,
    description: 'Client has no overdue installments.',
  })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  sendReminder(@Param('clientId') clientId: string): Promise<MessageLog> {
    return this.overdueReminderService.sendReminderForClient(clientId);
  }

  @Post('clients/:clientId/send-upcoming-due')
  @ApiOperation({
    summary:
      'Manually trigger the upcoming-due reminder for one client (admin only)',
    description:
      'Same grouping/rendering logic as the daily job, triggered on demand.',
  })
  @ApiResponse({ status: 201, description: 'Returns the created message log.' })
  @ApiResponse({
    status: 400,
    description:
      'Client has no installments approaching their due date across their active loans.',
  })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  sendUpcomingDueReminder(
    @Param('clientId') clientId: string,
  ): Promise<MessageLog> {
    return this.upcomingDueReminderService.sendReminderForClient(clientId);
  }

  @Post('clients/:clientId/send-account-summary')
  @ApiOperation({
    summary:
      'Manually send the full account summary to one client (admin only)',
    description:
      "Every pending installment across all of the client's active loans, overdue or not, ending in a grand total. On-demand only — no cron.",
  })
  @ApiResponse({ status: 201, description: 'Returns the created message log.' })
  @ApiResponse({
    status: 400,
    description:
      'Client has no pending installments across their active loans.',
  })
  @ApiResponse({ status: 404, description: 'Client not found.' })
  sendAccountSummary(@Param('clientId') clientId: string): Promise<MessageLog> {
    return this.accountSummaryService.sendAccountSummary(clientId);
  }
}
