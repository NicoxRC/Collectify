import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaginatedResult } from '../../common/interfaces/paginatedResult.interface';
import { MessageLog } from '../entities/messageLog.entity';

import { QueryMessageLogsDto } from './dto/queryMessageLogs.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class MessageLogsService {
  constructor(
    @InjectRepository(MessageLog)
    private readonly messageLogsRepository: Repository<MessageLog>,
  ) {}

  async findAll(
    query: QueryMessageLogsDto,
  ): Promise<PaginatedResult<MessageLog>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const qb = this.messageLogsRepository
      .createQueryBuilder('messageLog')
      .orderBy('messageLog.sentAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.clientId) {
      qb.andWhere('messageLog.clientId = :clientId', {
        clientId: query.clientId,
      });
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

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
