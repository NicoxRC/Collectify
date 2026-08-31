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
import { MessageFrequencyThrottleService } from './messageFrequencyThrottle.service';
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
    private readonly messageFrequencyThrottleService: MessageFrequencyThrottleService,
    private readonly whatsAppService: WhatsAppService,
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  // Phase 27 reverses Phase 18's "curated audience is a required filter"
  // design: every client who dynamically qualifies (an installment
  // approaching due date) is messaged again, with no group to populate
  // first. A whitelisted client's frequency is then throttled — see
  // MessageFrequencyThrottleService — but the whitelist only narrows
  // further, it never adds eligibility, and an empty/nonexistent
  // whitelist never blocks anyone. See
  // docs/phases/PHASE_27_MESSAGE_FREQUENCY.md.
  async runDailyReminder(): Promise<void> {
    const dynamicClientIds = await this.findClientIdsWithUpcomingInstallments();
    const clientIds =
      await this.messageFrequencyThrottleService.filterOutThrottledClients(
        dynamicClientIds,
        MessageType.UpcomingDue,
      );
    this.logger.log(
      `Daily upcoming-due reminder: ${clientIds.length} client(s) to notify`,
    );

    for (const clientId of clientIds) {
      try {
        await this.sendReminderForClient(clientId);
      } catch (error) {
        this.logger.error(
          `Failed to send upcoming-due reminder to client ${clientId}`,
          error,
        );
      }
    }
  }

  // allowEmpty (default false, unchanged for the manual on-demand controller
  // endpoint): every client the daily cron now calls this with already
  // dynamically qualifies (the audience filter only narrows, never adds),
  // so it never needs allowEmpty. Still used by the manual "retry a failed
  // message" flow (MessageLogsService), which resends regardless of the
  // client's current status. See docs/phases/PHASE_18_MESSAGE_AUDIENCES.md.
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
