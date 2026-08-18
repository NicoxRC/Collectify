import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  ILike,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';

import { AccountSummaryService } from '../accountSummary.service';
import { PaginatedResult } from '../../common/interfaces/paginatedResult.interface';
import { MessageLog, MessageLogStatus } from '../entities/messageLog.entity';
import { MessageLogItem } from '../entities/messageLogItem.entity';
import { MessageType } from '../messageType.enum';
import { NewLoanReminderService } from '../newLoanReminder.service';
import { OverdueReminderService } from '../overdueReminder.service';
import { UpcomingDueReminderService } from '../upcomingDueReminder.service';

import { QueryMessageLogsDto } from './dto/queryMessageLogs.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class MessageLogsService {
  constructor(
    @InjectRepository(MessageLog)
    private readonly messageLogsRepository: Repository<MessageLog>,
    @InjectRepository(MessageLogItem)
    private readonly messageLogItemsRepository: Repository<MessageLogItem>,
    private readonly overdueReminderService: OverdueReminderService,
    private readonly upcomingDueReminderService: UpcomingDueReminderService,
    private readonly newLoanReminderService: NewLoanReminderService,
    private readonly accountSummaryService: AccountSummaryService,
  ) {}

  async findAll(
    query: QueryMessageLogsDto,
  ): Promise<PaginatedResult<MessageLog>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const base: FindOptionsWhere<MessageLog> = {};
    if (query.clientId) {
      base.clientId = query.clientId;
    }
    if (query.type) {
      base.type = query.type;
    }
    if (query.status) {
      base.status = query.status;
    }
    if (query.dateFrom && query.dateTo) {
      base.sentAt = Between(new Date(query.dateFrom), new Date(query.dateTo));
    } else if (query.dateFrom) {
      base.sentAt = MoreThanOrEqual(new Date(query.dateFrom));
    } else if (query.dateTo) {
      base.sentAt = LessThanOrEqual(new Date(query.dateTo));
    }

    // The list screen shows the client's name, not just their id, and
    // `search` (added for the Mensajes list's search box) matches against
    // it — an array of where objects here is an OR of each variant, each
    // still combined with every filter above.
    const search = query.search ? `%${query.search}%` : undefined;
    const where: FindOptionsWhere<MessageLog>[] | FindOptionsWhere<MessageLog> =
      search
        ? [
            { ...base, client: { firstName: ILike(search) } },
            { ...base, client: { lastName: ILike(search) } },
          ]
        : base;

    const [items, total] = await this.messageLogsRepository.findAndCount({
      where,
      relations: { client: true },
      order: { sentAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Backs the "Mensaje completo" drawer's related-installments section
  // (Fase 5 client UI) — a single overdue reminder can cover several
  // installments across several loans (it's consolidated per client, not
  // per loan), so this returns a list, not a single "related loan".
  async getItems(id: string): Promise<MessageLogItem[]> {
    const log = await this.messageLogsRepository.findOneBy({ id });
    if (!log) {
      throw new NotFoundException(`Message log with id ${id} not found`);
    }

    return this.messageLogItemsRepository.find({
      where: { messageLogId: id },
      relations: { installment: { loan: true } },
      order: { createdAt: 'ASC' },
    });
  }

  // Manual retry (Phase 18) — append-only, per the entity comment: the
  // original row is stamped with retriedAt, and the new send creates a
  // fresh row pointing back at it via retryOfMessageLogId. Re-sends with
  // allowEmpty, since the client's situation may have changed since the
  // original attempt failed — the retry's purpose is to get a message out,
  // not to re-validate whether one is still owed. See
  // docs/phases/PHASE_18_MESSAGE_AUDIENCES.md.
  async retry(id: string): Promise<MessageLog> {
    const original = await this.messageLogsRepository.findOneBy({ id });
    if (!original) {
      throw new NotFoundException(`Message log with id ${id} not found`);
    }
    if (original.status !== MessageLogStatus.Failed) {
      throw new BadRequestException('Only failed messages can be retried');
    }

    const retryLog = await this.dispatchRetry(original);

    await this.messageLogsRepository.update(
      { id: original.id },
      { retriedAt: new Date() },
    );
    await this.messageLogsRepository.update(
      { id: retryLog.id },
      { retryOfMessageLogId: original.id },
    );

    return retryLog;
  }

  private async dispatchRetry(original: MessageLog): Promise<MessageLog> {
    switch (original.type) {
      case MessageType.Overdue:
        return this.overdueReminderService.sendReminderForClient(
          original.clientId,
          { allowEmpty: true },
        );
      case MessageType.UpcomingDue:
        return this.upcomingDueReminderService.sendReminderForClient(
          original.clientId,
          { allowEmpty: true },
        );
      case MessageType.AccountSummary:
        return this.accountSummaryService.sendAccountSummary(
          original.clientId,
          { allowEmpty: true },
        );
      case MessageType.NewLoan: {
        // new_loan messages are keyed by loan, not client — recover the
        // loanId through any of the message's items (they all belong to
        // the same loan, since sendNewLoanMessage gathers installments by
        // loanId).
        const item = await this.messageLogItemsRepository.findOne({
          where: { messageLogId: original.id },
          relations: { installment: true },
        });
        if (!item) {
          throw new BadRequestException(
            `Cannot retry message log ${original.id}: no related installments found`,
          );
        }
        return this.newLoanReminderService.sendNewLoanMessage(
          item.installment.loanId,
        );
      }
    }
  }
}
