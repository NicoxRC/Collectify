import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { Installment } from '../loans/entities/installment.entity';
import { Loan } from '../loans/entities/loan.entity';

import { MessageLog, MessageLogStatus } from './entities/messageLog.entity';
import { MessageLogItem } from './entities/messageLogItem.entity';
import { renderNewLoanMessage } from './messageRenderer';
import { MessageTemplatesService } from './messageTemplates/messageTemplates.service';
import { MessageType } from './messageType.enum';
import { WhatsAppService } from './whatsapp.service';

// Sent once, synchronously, right after a loan (or a refinance's new loan)
// is created — see docs/phases/PHASE_9_MESSAGE_TYPES.md. Callers are
// expected to catch and log failures themselves rather than let a
// messaging failure block the loan operation — same principle as the rest
// of this module (a failed/skipped send is a business outcome, not an
// application error).
@Injectable()
export class NewLoanReminderService {
  private readonly logger = new Logger(NewLoanReminderService.name);

  constructor(
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

  // Retry/backstop cron (Phase 18) — the synchronous send at loan creation
  // is primary; this sweeps up loans whose synchronous send never marked
  // newLoanMessageSentAt (it failed, or the process crashed before it
  // could). No natural periodic candidate list exists for "new loan" the
  // way overdue/upcoming-due have one, so newLoanMessageSentAt IS NULL is
  // both the candidate query and the completion marker. See
  // docs/phases/PHASE_18_MESSAGE_AUDIENCES.md.
  async runPendingNotifications(): Promise<void> {
    const loans = await this.loansRepository.find({
      where: { newLoanMessageSentAt: IsNull() },
    });
    this.logger.log(
      `New-loan retry: ${loans.length} loan(s) pending notification`,
    );

    for (const loan of loans) {
      try {
        const messageLog = await this.sendNewLoanMessage(loan.id);
        if (messageLog.status === MessageLogStatus.Sent) {
          await this.loansRepository.update(
            { id: loan.id },
            { newLoanMessageSentAt: new Date() },
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to retry new-loan message for loan ${loan.id}`,
          error,
        );
      }
    }
  }

  async sendNewLoanMessage(loanId: string): Promise<MessageLog> {
    const loan = await this.loansRepository.findOne({
      where: { id: loanId },
      relations: ['client'],
    });
    if (!loan) {
      throw new NotFoundException(`Loan with id ${loanId} not found`);
    }

    const installments = await this.installmentsRepository.find({
      where: { loanId },
      order: { installmentNumber: 'ASC' },
    });

    const template = await this.messageTemplatesService.findByTypeOrThrow(
      MessageType.NewLoan,
    );
    const messageContent = renderNewLoanMessage(template.content, {
      clientFullName: `${loan.client.firstName} ${loan.client.lastName}`,
      promissoryNoteNumber: loan.promissoryNoteNumber,
      loanDescription: loan.description,
      disbursedAt: loan.disbursedAt,
      totalInstallments: loan.totalInstallments,
      installmentAmounts: installments.map((installment) => installment.amount),
    });

    const sent = await this.whatsAppService.sendTextMessage(
      loan.client.phoneNumber,
      messageContent,
    );

    const messageLog = this.messageLogsRepository.create({
      clientId: loan.clientId,
      type: MessageType.NewLoan,
      phoneNumber: loan.client.phoneNumber,
      messageContent,
      status: sent ? MessageLogStatus.Sent : MessageLogStatus.Failed,
      sentAt: new Date(),
    });
    const savedLog = await this.messageLogsRepository.save(messageLog);

    // overdueDaysSnapshot/interestSnapshot are legitimately 0 here — a
    // brand-new installment is never overdue. See docs/DATABASE.md.
    const items = installments.map((installment) =>
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
}
