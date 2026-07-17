import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Client } from '../clients/entities/client.entity';
import {
  Installment,
  InstallmentStatus,
} from '../loans/entities/installment.entity';
import { LoanStatus } from '../loans/entities/loan.entity';
import { enrichInstallment } from '../loans/installments/enrichInstallment';

import { MessageLog, MessageLogStatus } from './entities/messageLog.entity';
import { MessageLogItem } from './entities/messageLogItem.entity';
import { MessageTemplateType } from './entities/messageTemplate.entity';
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
    private readonly whatsAppService: WhatsAppService,
  ) {}

  // Weekly job entry point — one client at a time, so one client's failure
  // doesn't stop the rest from being reminded.
  async runWeeklyReminder(): Promise<void> {
    const clientIds = await this.findClientIdsWithOverdueInstallments();
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
  async sendReminderForClient(clientId: string): Promise<MessageLog> {
    const client = await this.clientsRepository.findOneBy({ id: clientId });
    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    const overdueInstallments = await this.gatherOverdueInstallments(clientId);
    if (overdueInstallments.length === 0) {
      throw new BadRequestException(
        `Client ${clientId} has no overdue installments across their active loans`,
      );
    }

    const template = await this.messageTemplatesService.findActiveOrThrow(
      MessageTemplateType.Overdue,
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

    const installments = await this.installmentsRepository
      .createQueryBuilder('installment')
      .innerJoinAndSelect('installment.loan', 'loan')
      .where('loan.clientId = :clientId', { clientId })
      .andWhere('loan.status = :loanStatus', { loanStatus: LoanStatus.Active })
      .andWhere('installment.status = :installmentStatus', {
        installmentStatus: InstallmentStatus.Pending,
      })
      .andWhere('installment.dueDate < :today', { today })
      .orderBy('installment.dueDate', 'ASC')
      .getMany();

    return installments.map((installment) => ({
      ...enrichInstallment(installment, installment.loan.interestRate),
      promissoryNoteNumber: installment.loan.promissoryNoteNumber,
    }));
  }

  private async findClientIdsWithOverdueInstallments(): Promise<string[]> {
    const today = new Date().toISOString().slice(0, 10);

    const rows = await this.installmentsRepository
      .createQueryBuilder('installment')
      .innerJoin('installment.loan', 'loan')
      .select('DISTINCT loan.client_id', 'clientId')
      .where('loan.status = :loanStatus', { loanStatus: LoanStatus.Active })
      .andWhere('installment.status = :installmentStatus', {
        installmentStatus: InstallmentStatus.Pending,
      })
      .andWhere('installment.dueDate < :today', { today })
      .getRawMany<{ clientId: string }>();

    return rows.map((row) => row.clientId);
  }
}
