import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Client } from '../clients/entities/client.entity';
import { Installment } from '../loans/entities/installment.entity';
import { Loan } from '../loans/entities/loan.entity';

import { AccountSummaryService } from './accountSummary.service';
import { MessageLog } from './entities/messageLog.entity';
import { MessageLogItem } from './entities/messageLogItem.entity';
import { MessageTemplate } from './entities/messageTemplate.entity';
import { MessageLogsController } from './messageLogs/messageLogs.controller';
import { MessageLogsService } from './messageLogs/messageLogs.service';
import { MessageTemplatesController } from './messageTemplates/messageTemplates.controller';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { NewLoanReminderService } from './newLoanReminder.service';
import { OverdueReminderCron } from './overdueReminder.cron';
import { OverdueReminderService } from './overdueReminder.service';
import { UpcomingDueReminderCron } from './upcomingDueReminder.cron';
import { UpcomingDueReminderService } from './upcomingDueReminder.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessageTemplate,
      MessageLog,
      MessageLogItem,
      Client,
      Installment,
      Loan,
    ]),
  ],
  controllers: [
    WhatsappController,
    MessageTemplatesController,
    MessageLogsController,
  ],
  providers: [
    WhatsAppService,
    MessageTemplatesService,
    MessageLogsService,
    OverdueReminderService,
    OverdueReminderCron,
    NewLoanReminderService,
    UpcomingDueReminderService,
    UpcomingDueReminderCron,
    AccountSummaryService,
  ],
  // LoansService calls NewLoanReminderService synchronously after creating
  // a loan — see docs/phases/PHASE_9_MESSAGE_TYPES.md. WhatsappModule does
  // not depend on LoansModule, so this one-directional export isn't
  // circular.
  exports: [NewLoanReminderService],
})
export class WhatsappModule {}
