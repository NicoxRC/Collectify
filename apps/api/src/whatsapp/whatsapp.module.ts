import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Client } from '../clients/entities/client.entity';
import { Installment } from '../loans/entities/installment.entity';

import { MessageLog } from './entities/messageLog.entity';
import { MessageLogItem } from './entities/messageLogItem.entity';
import { MessageTemplate } from './entities/messageTemplate.entity';
import { MessageLogsController } from './messageLogs/messageLogs.controller';
import { MessageLogsService } from './messageLogs/messageLogs.service';
import { MessageTemplatesController } from './messageTemplates/messageTemplates.controller';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { OverdueReminderCron } from './overdueReminder.cron';
import { OverdueReminderService } from './overdueReminder.service';
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
  ],
})
export class WhatsappModule {}
