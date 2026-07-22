import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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

    // Joins client — the list screen shows the client's name, not just
    // their id, and `search` (added for the Mensajes list's search box)
    // matches against it.
    const qb = this.messageLogsRepository
      .createQueryBuilder('messageLog')
      .leftJoinAndSelect('messageLog.client', 'client')
      .orderBy('messageLog.sentAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.clientId) {
      qb.andWhere('messageLog.clientId = :clientId', {
        clientId: query.clientId,
      });
    }
    if (query.type) {
      qb.andWhere('messageLog.type = :type', { type: query.type });
    }
    if (query.status) {
      qb.andWhere('messageLog.status = :status', { status: query.status });
    }
    if (query.dateFrom) {
      qb.andWhere('messageLog.sentAt >= :dateFrom', {
        dateFrom: query.dateFrom,
      });
    }
    if (query.dateTo) {
      qb.andWhere('messageLog.sentAt <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.search) {
      qb.andWhere(
        '(client.firstName ILIKE :search OR client.lastName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();

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
