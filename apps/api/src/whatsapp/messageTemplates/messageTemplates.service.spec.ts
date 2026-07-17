import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  MessageTemplate,
  MessageTemplateType,
} from '../entities/messageTemplate.entity';

import { MessageTemplatesService } from './messageTemplates.service';

describe('MessageTemplatesService', () => {
  let service: MessageTemplatesService;
  let repository: {
    find: jest.Mock;
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let queryBuilder: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    execute: jest.Mock;
  };

  const mockTemplate: MessageTemplate = {
    id: 'template-1',
    name: 'Weekly reminder',
    type: MessageTemplateType.Overdue,
    content: 'Hola {{clientFullName}}',
    isActive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn(),
    };
    repository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn((dto: Partial<MessageTemplate>) => dto),
      save: jest.fn(),
      manager: {
        transaction: jest.fn(
          async (fn: (manager: unknown) => Promise<void>) => {
            const manager = {
              createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
            };
            await fn(manager);
          },
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageTemplatesService,
        { provide: getRepositoryToken(MessageTemplate), useValue: repository },
      ],
    }).compile();

    service = module.get<MessageTemplatesService>(MessageTemplatesService);
  });

  describe('create', () => {
    it('creates a template as inactive by default', async () => {
      repository.save.mockResolvedValue({ ...mockTemplate });

      await service.create({
        name: mockTemplate.name,
        type: mockTemplate.type,
        content: mockTemplate.content,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the template does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findActiveOrThrow', () => {
    it('returns the active template for the given type', async () => {
      repository.findOneBy.mockResolvedValue({
        ...mockTemplate,
        isActive: true,
      });

      const result = await service.findActiveOrThrow(
        MessageTemplateType.Overdue,
      );

      expect(result.isActive).toBe(true);
      expect(repository.findOneBy).toHaveBeenCalledWith({
        type: MessageTemplateType.Overdue,
        isActive: true,
      });
    });

    it('throws NotFoundException when no template of that type is active', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.findActiveOrThrow(MessageTemplateType.NewLoan),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('activate', () => {
    it('deactivates other templates of the same type before activating the given one', async () => {
      repository.findOneBy
        .mockResolvedValueOnce(mockTemplate) // existence check
        .mockResolvedValueOnce({ ...mockTemplate, isActive: true }); // final findOne

      await service.activate(mockTemplate.id);

      expect(queryBuilder.set).toHaveBeenNthCalledWith(1, { isActive: false });
      expect(queryBuilder.where).toHaveBeenNthCalledWith(1, 'type = :type', {
        type: mockTemplate.type,
      });
      expect(queryBuilder.set).toHaveBeenNthCalledWith(2, { isActive: true });
      expect(queryBuilder.where).toHaveBeenNthCalledWith(2, 'id = :id', {
        id: mockTemplate.id,
      });
    });

    it('throws NotFoundException when the template does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.activate('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.manager.transaction).not.toHaveBeenCalled();
    });
  });
});
