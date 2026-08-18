import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Client } from '../clients/entities/client.entity';
import { Configuration } from '../config/configuration';
import { addDaysToDateString, todayDateString } from '../loans/dueDateSchedule';
import {
  Installment,
  InstallmentStatus,
} from '../loans/entities/installment.entity';
import { LoanStatus } from '../loans/entities/loan.entity';
import { calculateDaysUntilDue } from '../loans/installments/installmentCalculations';

import { MessageLog, MessageLogStatus } from './entities/messageLog.entity';
import { MessageLogItem } from './entities/messageLogItem.entity';
import { MessageAudiencesService } from './messageAudiences/messageAudiences.service';
import { renderUpcomingDueMessage } from './messageRenderer';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { MessageType } from './messageType.enum';
import { WhatsAppService } from './whatsapp.service';

// Daily job — sends the "Aviso" reminder as an installment approaches its
// due date, at the configurable day thresholds (UPCOMING_DUE_REMINDER_DAYS,
// default 5/3/1). Same "group by client, across all their active loans"
// rule as the overdue reminder. See docs/phases/PHASE_9_MESSAGE_TYPES.md.
@Injectable()
export class UpcomingDueReminderService {
  private readonly logger = new Logger(UpcomingDueReminderService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    @InjectRepository(Installment)
    private readonly installmentsRepository: Repository<Installment>,
    @InjectRepository(MessageLog)
    private readonly messageLogsRepository: Repository<MessageLog>,
    @InjectRepository(MessageLogItem)
    private readonly messageLogItemsRepository: Repository<MessageLogItem>,
    private readonly messageTemplatesService: MessageTemplatesService,
    private readonly messageAudiencesService: MessageAudiencesService,
    private readonly whatsAppService: WhatsAppService,
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  // The curated audience is additive: its members are always notified
  // alongside whoever dynamically qualifies, even with nothing approaching
  // due date themselves (allowEmpty). See
  // docs/phases/PHASE_18_MESSAGE_AUDIENCES.md.
  async runDailyReminder(): Promise<void> {
    const [dynamicClientIds, audienceClientIds] = await Promise.all([
      this.findClientIdsWithUpcomingInstallments(),
      this.messageAudiencesService.getClientIdsForTemplateType(
        MessageType.UpcomingDue,
      ),
    ]);
    const clientIds = [...new Set([...dynamicClientIds, ...audienceClientIds])];
    this.logger.log(
      `Daily upcoming-due reminder: ${clientIds.length} client(s) to notify`,
    );

    for (const clientId of clientIds) {
      try {
        await this.sendReminderForClient(clientId, { allowEmpty: true });
      } catch (error) {
        this.logger.error(
          `Failed to send upcoming-due reminder to client ${clientId}`,
          error,
        );
      }
    }
  }

  // allowEmpty (default false, unchanged for the manual on-demand controller
  // endpoint): the daily cron passes true for audience members who don't
  // dynamically qualify, so they still get a message — rendered with an
  // empty list — instead of being skipped. See
  // docs/phases/PHASE_18_MESSAGE_AUDIENCES.md.
  async sendReminderForClient(
    clientId: string,
    options?: { allowEmpty?: boolean },
  ): Promise<MessageLog> {
    const client = await this.clientsRepository.findOneBy({ id: clientId });
    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    const upcomingInstallments =
      await this.gatherUpcomingInstallments(clientId);
    if (upcomingInstallments.length === 0 && !options?.allowEmpty) {
      throw new BadRequestException(
        `Client ${clientId} has no installments approaching their due date across their active loans`,
      );
    }

    const template = await this.messageTemplatesService.findByTypeOrThrow(
      MessageType.UpcomingDue,
    );
    const messageContent = renderUpcomingDueMessage(
      template.content,
      `${client.firstName} ${client.lastName}`,
      upcomingInstallments,
    );

    const sent = await this.whatsAppService.sendTextMessage(
      client.phoneNumber,
      messageContent,
    );

    const messageLog = this.messageLogsRepository.create({
      clientId,
      type: MessageType.UpcomingDue,
      phoneNumber: client.phoneNumber,
      messageContent,
      status: sent ? MessageLogStatus.Sent : MessageLogStatus.Failed,
      sentAt: new Date(),
    });
    const savedLog = await this.messageLogsRepository.save(messageLog);

    // overdueDaysSnapshot/interestSnapshot are legitimately 0 — none of
    // these installments are overdue yet. "Days until due" isn't stored as
    // a separate column; it's preserved in messageContent. See
    // docs/DATABASE.md "Added in Phase 9".
    const items = upcomingInstallments.map((installment) =>
      this.messageLogItemsRepository.create({
        messageLogId: savedLog.id,
        installmentId: installment.id,
        overdueDaysSnapshot: 0,
        interestSnapshot: 0,
      }),
    );
    await this.messageLogItemsRepository.save(items);

    return savedLog;
  }

  private async gatherUpcomingInstallments(clientId: string) {
    const today = todayDateString();
    const { upcomingDueReminderDays } = this.configService.get('cron', {
      infer: true,
    });
    const targetDates = upcomingDueReminderDays.map((days) =>
      addDaysToDateString(today, days),
    );

    const installments = await this.installmentsRepository.find({
      where: {
        status: InstallmentStatus.Pending,
        dueDate: In(targetDates),
        loan: { clientId, status: LoanStatus.Active },
      },
      relations: { loan: true },
      order: { dueDate: 'ASC' },
    });

    return installments.map((installment) => ({
      id: installment.id,
      installmentNumber: installment.installmentNumber,
      promissoryNoteNumber: installment.loan.promissoryNoteNumber,
      amount: installment.amount,
      daysUntilDue: calculateDaysUntilDue(new Date(installment.dueDate)),
    }));
  }

  private async findClientIdsWithUpcomingInstallments(): Promise<string[]> {
    const today = todayDateString();
    const { upcomingDueReminderDays } = this.configService.get('cron', {
      infer: true,
    });
    const targetDates = upcomingDueReminderDays.map((days) =>
      addDaysToDateString(today, days),
    );

    const installments = await this.installmentsRepository.find({
      where: {
        status: InstallmentStatus.Pending,
        dueDate: In(targetDates),
        loan: { status: LoanStatus.Active },
      },
      relations: { loan: true },
    });

    return [
      ...new Set(installments.map((installment) => installment.loan.clientId)),
    ];
  }
}
