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
import { Loan, LoanStatus } from '../loans/entities/loan.entity';
import { enrichInstallment } from '../loans/installments/enrichInstallment';
import { calculateDaysUntilDue } from '../loans/installments/installmentCalculations';

import { MessageLog, MessageLogStatus } from './entities/messageLog.entity';
import { MessageLogItem } from './entities/messageLogItem.entity';
import { renderAccountSummaryMessage } from './messageRenderer';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { MessageType } from './messageType.enum';
import { WhatsAppService } from './whatsapp.service';

// Manual send is still on-demand — a full account statement is something
// the admin sends when a client asks for their status. The cron
// (runActiveClientSummaries) is separate and sends to every client with at
// least one active loan — no curated audience involved (corrected after
// client QA, 2026-08-18: account_summary originally sent only to a manually
// curated audience, per Phase 18; the audience concept was dropped for this
// type entirely). See docs/phases/PHASE_18_MESSAGE_AUDIENCES.md "Extended
// after client QA". Lists every pending installment (overdue or not) across
// all of a client's active loans, ending in a grand total — the combined
// "list all active pagarés" + "total across all credits" message. See
// docs/phases/PHASE_9_MESSAGE_TYPES.md for why these were combined.
@Injectable()
export class AccountSummaryService {
  private readonly logger = new Logger(AccountSummaryService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
    @InjectRepository(Loan)
    private readonly loansRepository: Repository<Loan>,
    @InjectRepository(Installment)
    private readonly installmentsRepository: Repository<Installment>,
    @InjectRepository(MessageLog)
    private readonly messageLogsRepository: Repository<MessageLog>,
    @InjectRepository(MessageLogItem)
    private readonly messageLogItemsRepository: Repository<MessageLogItem>,
    private readonly messageTemplatesService: MessageTemplatesService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  // account_summary's cron entry point — every client with at least one
  // active loan gets a summary, regardless of whether they currently owe
  // anything overdue. See the class doc comment above.
  async runActiveClientSummaries(): Promise<void> {
    const clientIds = await this.findClientIdsWithActiveLoan();
    this.logger.log(
      `Account summary run: ${clientIds.length} client(s) to notify`,
    );

    for (const clientId of clientIds) {
      try {
        await this.sendAccountSummary(clientId, { allowEmpty: true });
      } catch (error) {
        this.logger.error(
          `Failed to send account summary to client ${clientId}`,
          error,
        );
      }
    }
  }

  private async findClientIdsWithActiveLoan(): Promise<string[]> {
    const loans = await this.loansRepository.find({
      where: { status: LoanStatus.Active },
      select: ['clientId'],
    });
    return [...new Set(loans.map((loan) => loan.clientId))];
  }

  // allowEmpty (default false, unchanged for the manual on-demand controller
  // endpoint): the cron passes true, since a client can have an active loan
  // with nothing currently pending/overdue — they still get a message,
  // rendered with an empty list/$0 rather than being skipped.
  async sendAccountSummary(
    clientId: string,
    options?: { allowEmpty?: boolean },
  ): Promise<MessageLog> {
    const client = await this.clientsRepository.findOneBy({ id: clientId });
    if (!client) {
      throw new NotFoundException(`Client with id ${clientId} not found`);
    }

    const pendingInstallments = await this.gatherPendingInstallments(clientId);
    if (pendingInstallments.length === 0 && !options?.allowEmpty) {
      throw new BadRequestException(
        `Client ${clientId} has no pending installments across their active loans`,
      );
    }

    const template = await this.messageTemplatesService.findByTypeOrThrow(
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
    const installments = await this.installmentsRepository.find({
      where: {
        status: InstallmentStatus.Pending,
        loan: { clientId, status: LoanStatus.Active },
      },
      relations: { loan: true },
      order: { dueDate: 'ASC' },
    });

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
