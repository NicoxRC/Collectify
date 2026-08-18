import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

import { AccountSummaryService } from './accountSummary.service';
import { UpdateCronScheduleDto } from './dto/updateCronSchedule.dto';
import { MessageLog } from './entities/messageLog.entity';
import { MessageTemplate } from './entities/messageTemplate.entity';
import { MessageType } from './messageType.enum';
import { OverdueReminderService } from './overdueReminder.service';
import { UpcomingDueReminderService } from './upcomingDueReminder.service';
import { WhatsappCronService } from './whatsappCron.service';

@ApiTags('whatsapp')
@ApiBearerAuth()
@Roles(UserRole.Admin)
@Controller('whatsapp')
export class WhatsappController {
  constructor(
    private readonly overdueReminderService: OverdueReminderService,
    private readonly upcomingDueReminderService: UpcomingDueReminderService,
    private readonly accountSummaryService: AccountSummaryService,
    private readonly whatsappCronService: WhatsappCronService,
  ) {}

  @Get('cron/:type/status')
  @ApiOperation({
    summary: "Whether a message type's cron job is running (admin only)",
    description:
      'All 4 message types have a cron job (Phase 18) — see docs/phases/PHASE_18_MESSAGE_AUDIENCES.md.',
  })
  @ApiResponse({ status: 200, description: 'Returns the job running state.' })
  getCronStatus(
    @Param('type', new ParseEnumPipe(MessageType)) type: MessageType,
  ): { running: boolean } {
    return this.whatsappCronService.getStatus(type);
  }

  @Post('cron/:type/pause')
  @ApiOperation({ summary: "Pause a message type's cron job (admin only)" })
  @ApiResponse({ status: 200, description: 'The job is paused.' })
  pauseCron(
    @Param('type', new ParseEnumPipe(MessageType)) type: MessageType,
  ): Promise<{ paused: true }> {
    return this.whatsappCronService.pause(type);
  }

  @Post('cron/:type/resume')
  @ApiOperation({ summary: "Resume a message type's cron job (admin only)" })
  @ApiResponse({ status: 200, description: 'The job is running again.' })
  resumeCron(
    @Param('type', new ParseEnumPipe(MessageType)) type: MessageType,
  ): { paused: false } {
    return this.whatsappCronService.resume(type);
  }

  @Patch('cron/:type/schedule')
  @ApiOperation({
    summary: "Change a message type's cron schedule (admin only)",
    description:
      'Persists the new expression on MessageTemplate.cronExpression and reschedules the running job immediately, without a restart.',
  })
  @ApiResponse({ status: 200, description: 'Returns the updated template.' })
  rescheduleCron(
    @Param('type', new ParseEnumPipe(MessageType)) type: MessageType,
    @Body() dto: UpdateCronScheduleDto,
  ): Promise<MessageTemplate> {
    return this.whatsappCronService.reschedule(type, dto.cronExpression);
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
      "Every pending installment across all of the client's active loans, overdue or not, ending in a grand total. On-demand only — separate from the audience-only cron.",
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
