import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { MessageTemplate } from '../entities/messageTemplate.entity';
import { MessageType } from '../messageType.enum';

import { MessageTemplatesService } from './messageTemplates.service';

describe('MessageTemplatesService', () => {
  let service: MessageTemplatesService;
  let repository: { find: jest.Mock; findOneBy: jest.Mock };

  const mockTemplate: MessageTemplate = {
    id: 'template-1',
    name: 'Weekly reminder',
    type: MessageType.Overdue,
    content: 'Hola {{clientFullName}}',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    repository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageTemplatesService,
        { provide: getRepositoryToken(MessageTemplate), useValue: repository },
      ],
    }).compile();

    service = module.get<MessageTemplatesService>(MessageTemplatesService);
  });

  describe('findAll', () => {
    it('returns every message template ordered by type', async () => {
      repository.find.mockResolvedValue([mockTemplate]);

      const result = await service.findAll();

      expect(result).toEqual([mockTemplate]);
      expect(repository.find).toHaveBeenCalledWith({ order: { type: 'ASC' } });
    });
  });

  describe('findByTypeOrThrow', () => {
    it('returns the template for the given type', async () => {
      repository.findOneBy.mockResolvedValue(mockTemplate);

      const result = await service.findByTypeOrThrow(MessageType.Overdue);

      expect(result).toEqual(mockTemplate);
      expect(repository.findOneBy).toHaveBeenCalledWith({
        type: MessageType.Overdue,
      });
    });

    it('throws NotFoundException when no template of that type exists', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.findByTypeOrThrow(MessageType.NewLoan),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
