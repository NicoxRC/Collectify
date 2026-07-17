import {
  BadRequestException,
  Injectable,
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
import { calculateDaysUntilDue } from '../loans/installments/installmentCalculations';

import { MessageLog, MessageLogStatus } from './entities/messageLog.entity';
import { MessageLogItem } from './entities/messageLogItem.entity';
import { renderAccountSummaryMessage } from './messageRenderer';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { MessageType } from './messageType.enum';
import { WhatsAppService } from './whatsapp.service';

// On-demand only, no cron — a full account statement is something the
// admin sends when a client asks for their status, not a scheduled push.
// Lists every pending installment (overdue or not) across all of a
// client's active loans, ending in a grand total — the combined "list all
// active pagarés" + "total across all credits" message. See
// docs/phases/PHASE_9_MESSAGE_TYPES.md for why these were combined.
@Injectable()
export class AccountSummaryService {
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

  async sendAccountSummary(clientId: string): Promise<MessageLog> {
    const client = await this.clientsRepository.findOneBy({ id: clientId });
    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    const pendingInstallments = await this.gatherPendingInstallments(clientId);
    if (pendingInstallments.length === 0) {
      throw new BadRequestException(
        `Client ${clientId} has no pending installments across their active loans`,
      );
    }

    const template = await this.messageTemplatesService.findActiveOrThrow(
      MessageType.AccountSummary,
    );
    const messageContent = renderAccountSummaryMessage(
      template.content,
      `${client.firstName} ${client.lastName}`,
      pendingInstallments,
    );

    const sent = await this.whatsAppService.sendTextMessage(
      client.phoneNumber,
      messageContent,
    );

    const messageLog = this.messageLogsRepository.create({
      clientId,
      type: MessageType.AccountSummary,
      phoneNumber: client.phoneNumber,
      messageContent,
      status: sent ? MessageLogStatus.Sent : MessageLogStatus.Failed,
      sentAt: new Date(),
    });
    const savedLog = await this.messageLogsRepository.save(messageLog);

    const items = pendingInstallments.map((installment) =>
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

  private async gatherPendingInstallments(clientId: string) {
    const installments = await this.installmentsRepository
      .createQueryBuilder('installment')
      .innerJoinAndSelect('installment.loan', 'loan')
      .where('loan.clientId = :clientId', { clientId })
      .andWhere('loan.status = :loanStatus', { loanStatus: LoanStatus.Active })
      .andWhere('installment.status = :installmentStatus', {
        installmentStatus: InstallmentStatus.Pending,
      })
      .orderBy('installment.dueDate', 'ASC')
      .getMany();

    return installments.map((installment) => {
      const enriched = enrichInstallment(
        installment,
        installment.loan.interestRate,
      );
      return {
        ...enriched,
        promissoryNoteNumber: installment.loan.promissoryNoteNumber,
        daysUntilDue: calculateDaysUntilDue(new Date(installment.dueDate)),
      };
    });
  }
}
