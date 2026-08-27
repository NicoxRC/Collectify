import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { Client } from '../clients/entities/client.entity';
import { Installment } from '../loans/entities/installment.entity';
import { Loan } from '../loans/entities/loan.entity';
import { UsersModule } from '../users/users.module';

import { AccountSummaryService } from './accountSummary.service';
import { MessageAudience } from './entities/messageAudience.entity';
import { MessageLog } from './entities/messageLog.entity';
import { MessageLogItem } from './entities/messageLogItem.entity';
import { MessageTemplate } from './entities/messageTemplate.entity';
import { WhatsappInboundMessage } from './entities/whatsappInboundMessage.entity';
import { MessageAudiencesService } from './messageAudiences/messageAudiences.service';
import { MessageLogsController } from './messageLogs/messageLogs.controller';
import { MessageLogsService } from './messageLogs/messageLogs.service';
import { MessageTemplatesController } from './messageTemplates/messageTemplates.controller';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { NewLoanReminderService } from './newLoanReminder.service';
import { OverdueReminderService } from './overdueReminder.service';
import { UpcomingDueReminderService } from './upcomingDueReminder.service';
import { WhatsappInboundGateway } from './webhook/whatsappInbound.gateway';
import { WhatsappWebhookController } from './webhook/whatsappWebhook.controller';
import { WhatsappWebhookService } from './webhook/whatsappWebhook.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappCronService } from './whatsappCron.service';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessageTemplate,
      MessageAudience,
      MessageLog,
      MessageLogItem,
      WhatsappInboundMessage,
      Client,
      Installment,
      Loan,
    ]),
    // AuthModule (for JwtModule) and UsersModule — WhatsappInboundGateway
    // verifies a socket connection's access token by hand, see its doc
    // comment.
    AuthModule,
    UsersModule,
  ],
  controllers: [
    WhatsappController,
    MessageTemplatesController,
    MessageLogsController,
    WhatsappWebhookController,
  ],
  providers: [
    WhatsAppService,
    MessageTemplatesService,
    MessageAudiencesService,
    MessageLogsService,
    OverdueReminderService,
    NewLoanReminderService,
    UpcomingDueReminderService,
    AccountSummaryService,
    WhatsappCronService,
    WhatsappWebhookService,
    WhatsappInboundGateway,
  ],
  // LoansService calls NewLoanReminderService synchronously after creating
  // a loan — see docs/phases/PHASE_9_MESSAGE_TYPES.md. WhatsappModule does
  // not depend on LoansModule, so this one-directional export isn't
  // circular.
  exports: [NewLoanReminderService],
})
export class WhatsappModule {}
