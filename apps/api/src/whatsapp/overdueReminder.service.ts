import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';

import { Client } from '../clients/entities/client.entity';
import {
  Installment,
  InstallmentStatus,
} from '../loans/entities/installment.entity';
import { LoanStatus } from '../loans/entities/loan.entity';
import { enrichInstallment } from '../loans/installments/enrichInstallment';

import { MessageLog, MessageLogStatus } from './entities/messageLog.entity';
import { MessageLogItem } from './entities/messageLogItem.entity';
import { MessageFrequencyThrottleService } from './messageFrequencyThrottle.service';
import { MessageType } from './messageType.enum';
import { renderOverdueReminderMessage } from './messageRenderer';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { WhatsAppService } from './whatsapp.service';

@Injectable()
export class OverdueReminderService {
  private readonly logger = new Logger(OverdueReminderService.name);

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
  ) {}

  // Weekly job entry point — one client at a time, so one client's failure
  // doesn't stop the rest from being reminded. Phase 27 reverses Phase
  // 18's "curated audience is a required filter" design: every client who
  // dynamically qualifies (has an overdue installment) is messaged again,
  // with no group to populate first. A whitelisted client's frequency is
  // then throttled — see MessageFrequencyThrottleService — but the
  // whitelist only narrows further, it never adds eligibility and an
  // empty/nonexistent whitelist never blocks anyone. See
  // docs/phases/PHASE_27_MESSAGE_FREQUENCY.md (and
  // docs/phases/PHASE_18_MESSAGE_AUDIENCES.md for the design this replaces).
  async runWeeklyReminder(): Promise<void> {
    const dynamicClientIds = await this.findClientIdsWithOverdueInstallments();
    const clientIds =
      await this.messageFrequencyThrottleService.filterOutThrottledClients(
        dynamicClientIds,
        MessageType.Overdue,
      );
    this.logger.log(
      `Weekly overdue reminder: ${clientIds.length} client(s) to notify`,
    );

    for (const clientId of clientIds) {
      try {
        await this.sendReminderForClient(clientId);
      } catch (error) {
        this.logger.error(
          `Failed to send overdue reminder to client ${clientId}`,
          error,
        );
      }
    }
  }

  // Gathers every overdue installment across ALL of a client's active
  // loans, renders one consolidated message, sends it, and logs it —
  // per the grouping rule in docs/phases/PHASE_5_WHATSAPP.md.
  //
  // allowEmpty (default false, unchanged for the manual on-demand
  // controller endpoint): every client the weekly cron now calls this with
  // already dynamically qualifies (the frequency throttle only narrows,
  // never adds — see docs/phases/PHASE_27_MESSAGE_FREQUENCY.md), so it
  // never needs allowEmpty. Still used by the manual "retry a failed
  // message" flow (MessageLogsService), which resends regardless of the
  // client's current mora status.
  async sendReminderForClient(
    clientId: string,
    options?: { allowEmpty?: boolean },
  ): Promise<MessageLog> {
    const client = await this.clientsRepository.findOneBy({ id: clientId });
    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    const overdueInstallments = await this.gatherOverdueInstallments(clientId);
    if (overdueInstallments.length === 0 && !options?.allowEmpty) {
      throw new BadRequestException(
        `Client ${clientId} has no overdue installments across their active loans`,
      );
    }

    const template = await this.messageTemplatesService.findByTypeOrThrow(
      MessageType.Overdue,
    );
    const messageContent = renderOverdueReminderMessage(
      template.content,
      `${client.firstName} ${client.lastName}`,
      overdueInstallments,
    );

    const sent = await this.whatsAppService.sendTextMessage(
      client.phoneNumber,
      messageContent,
    );

    const messageLog = this.messageLogsRepository.create({
      clientId,
      type: MessageType.Overdue,
      phoneNumber: client.phoneNumber,
      messageContent,
      status: sent ? MessageLogStatus.Sent : MessageLogStatus.Failed,
      sentAt: new Date(),
    });
    const savedLog = await this.messageLogsRepository.save(messageLog);

    const items = overdueInstallments.map((installment) =>
      this.messageLogItemsRepository.create({
        messageLogId: savedLog.id,
        installmentId: installment.id,
        overdueDaysSnapshot: installment.overdueDays,
        interestSnapshot: installment.interest,
      }),
    );
    await this.messageLogItemsRepository.save(items);

    return savedLog;
  }

  private async gatherOverdueInstallments(clientId: string) {
    const today = new Date().toISOString().slice(0, 10);

    const installments = await this.installmentsRepository.find({
      where: {
        status: InstallmentStatus.Pending,
        dueDate: LessThan(today),
        loan: { clientId, status: LoanStatus.Active },
      },
      relations: { loan: true },
      order: { dueDate: 'ASC' },
    });

    return installments.map((installment) => ({
      ...enrichInstallment(installment, installment.loan.interestRate),
      promissoryNoteNumber: installment.loan.promissoryNoteNumber,
    }));
  }

  private async findClientIdsWithOverdueInstallments(): Promise<string[]> {
    const today = new Date().toISOString().slice(0, 10);

    const installments = await this.installmentsRepository.find({
      where: {
        status: InstallmentStatus.Pending,
        dueDate: LessThan(today),
        loan: { status: LoanStatus.Active },
      },
      relations: { loan: true },
    });

    return [
      ...new Set(installments.map((installment) => installment.loan.clientId)),
    ];
  }
}
