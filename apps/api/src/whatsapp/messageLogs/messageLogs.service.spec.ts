import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { MessageLog, MessageLogStatus } from '../entities/messageLog.entity';
import { MessageLogItem } from '../entities/messageLogItem.entity';
import { MessageType } from '../messageType.enum';

import { MessageLogsService } from './messageLogs.service';

describe('MessageLogsService', () => {
  let service: MessageLogsService;
  let repository: { createQueryBuilder: jest.Mock; findOneBy: jest.Mock };
  let messageLogItemsRepository: { find: jest.Mock };
  let queryBuilder: {
    leftJoinAndSelect: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    andWhere: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  const mockLog: MessageLog = {
    id: 'log-1',
    clientId: 'client-1',
    client: undefined as never,
    type: MessageType.Overdue,
    phoneNumber: '+573001234567',
    messageContent: 'Hola...',
    status: MessageLogStatus.Sent,
    sentAt: new Date(),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOneBy: jest.fn(),
    };
    messageLogItemsRepository = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageLogsService,
        { provide: getRepositoryToken(MessageLog), useValue: repository },
        {
          provide: getRepositoryToken(MessageLogItem),
          useValue: messageLogItemsRepository,
        },
      ],
    }).compile();

    service = module.get<MessageLogsService>(MessageLogsService);
  });

  it('returns a paginated page and applies the clientId/type/status/date filters', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[mockLog], 1]);

    const result = await service.findAll({
      clientId: 'client-1',
      type: MessageType.Overdue,
      status: MessageLogStatus.Sent,
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });

    expect(result).toEqual({
      items: [mockLog],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'messageLog.clientId = :clientId',
      {
        clientId: 'client-1',
      },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'messageLog.type = :type',
      {
        type: MessageType.Overdue,
      },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'messageLog.status = :status',
      {
        status: MessageLogStatus.Sent,
      },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'messageLog.sentAt >= :dateFrom',
      {
        dateFrom: '2026-01-01',
      },
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'messageLog.sentAt <= :dateTo',
      {
        dateTo: '2026-01-31',
      },
    );
  });

  it('returns an empty page when there are no matches', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

    const result = await service.findAll({});

    expect(result.items).toEqual([]);
    expect(result.meta.totalPages).toBe(0);
  });

  it('joins client and applies the search filter against first/last name', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([[mockLog], 1]);

    await service.findAll({ search: 'Juana' });

    expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
      'messageLog.client',
      'client',
    );
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      '(client.firstName ILIKE :search OR client.lastName ILIKE :search)',
      { search: '%Juana%' },
    );
  });

  describe('getItems', () => {
    it('returns the items for an existing message log', async () => {
      repository.findOneBy.mockResolvedValue(mockLog);
      const items = [{ id: 'item-1', messageLogId: 'log-1' }];
      messageLogItemsRepository.find.mockResolvedValue(items);

      const result = await service.getItems('log-1');

      expect(result).toEqual(items);
      expect(messageLogItemsRepository.find).toHaveBeenCalledWith({
        where: { messageLogId: 'log-1' },
        relations: { installment: { loan: true } },
        order: { createdAt: 'ASC' },
      });
    });

    it('throws NotFoundException when the message log does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.getItems('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(messageLogItemsRepository.find).not.toHaveBeenCalled();
    });
  });
});
