import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  FindOptionsWhere,
  ILike,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';

import { PaginatedResult } from '../../common/interfaces/paginatedResult.interface';
import { MessageLog } from '../entities/messageLog.entity';
import { MessageLogItem } from '../entities/messageLogItem.entity';

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
}
