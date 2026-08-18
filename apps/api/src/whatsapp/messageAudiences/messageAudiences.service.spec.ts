import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Client } from '../../clients/entities/client.entity';
import { MessageAudience } from '../entities/messageAudience.entity';
import { MessageTemplate } from '../entities/messageTemplate.entity';
import { MessageTemplatesService } from '../messageTemplates/messageTemplates.service';
import { MessageType } from '../messageType.enum';

import { MessageAudiencesService } from './messageAudiences.service';

describe('MessageAudiencesService', () => {
  let service: MessageAudiencesService;
  let audiencesRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let clientsRepository: { findBy: jest.Mock };
  let messageTemplatesService: { findByTypeOrThrow: jest.Mock };

  const mockTemplate: MessageTemplate = {
    id: 'template-1',
    name: 'Weekly reminder',
    type: MessageType.Overdue,
    content: 'Hola {{clientFullName}}',
    cronExpression: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockClient = { id: 'client-1' } as Client;

  const mockAudience: MessageAudience = {
    id: 'audience-1',
    messageTemplateId: mockTemplate.id,
    messageTemplate: mockTemplate,
    name: 'Weekly reminder audience',
    clients: [mockClient],
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    audiencesRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    clientsRepository = { findBy: jest.fn() };
    messageTemplatesService = { findByTypeOrThrow: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageAudiencesService,
        {
          provide: getRepositoryToken(MessageAudience),
          useValue: audiencesRepository,
        },
        { provide: getRepositoryToken(Client), useValue: clientsRepository },
        {
          provide: MessageTemplatesService,
          useValue: messageTemplatesService,
        },
      ],
    }).compile();

    service = module.get<MessageAudiencesService>(MessageAudiencesService);
  });

  describe('getForType', () => {
    it('returns the most recent audience for the template type', async () => {
      messageTemplatesService.findByTypeOrThrow.mockResolvedValue(mockTemplate);
      audiencesRepository.findOne.mockResolvedValue(mockAudience);

      const result = await service.getForType(MessageType.Overdue);

      expect(result).toEqual(mockAudience);
      expect(audiencesRepository.findOne).toHaveBeenCalledWith({
        where: { messageTemplateId: mockTemplate.id },
        relations: ['clients'],
        order: { createdAt: 'DESC' },
      });
    });

    it('returns null when no audience has been set yet', async () => {
      messageTemplatesService.findByTypeOrThrow.mockResolvedValue(mockTemplate);
      audiencesRepository.findOne.mockResolvedValue(null);

      const result = await service.getForType(MessageType.Overdue);

      expect(result).toBeNull();
    });
  });

  describe('getClientIdsForTemplateType', () => {
    it('returns the client ids from the audience', async () => {
      messageTemplatesService.findByTypeOrThrow.mockResolvedValue(mockTemplate);
      audiencesRepository.findOne.mockResolvedValue(mockAudience);

      const result = await service.getClientIdsForTemplateType(
        MessageType.Overdue,
      );

      expect(result).toEqual(['client-1']);
    });

    it('returns an empty array when no audience has been set yet', async () => {
      messageTemplatesService.findByTypeOrThrow.mockResolvedValue(mockTemplate);
      audiencesRepository.findOne.mockResolvedValue(null);

      const result = await service.getClientIdsForTemplateType(
        MessageType.Overdue,
      );

      expect(result).toEqual([]);
    });
  });

  describe('upsertForType', () => {
    it('creates a new audience when none exists yet', async () => {
      messageTemplatesService.findByTypeOrThrow.mockResolvedValue(mockTemplate);
      clientsRepository.findBy.mockResolvedValue([mockClient]);
      audiencesRepository.findOne.mockResolvedValue(null);
      const created = { ...mockAudience, clients: [] };
      audiencesRepository.create.mockReturnValue(created);
      audiencesRepository.save.mockImplementation((audience) =>
        Promise.resolve(audience),
      );

      const result = await service.upsertForType(MessageType.Overdue, [
        'client-1',
      ]);

      expect(audiencesRepository.create).toHaveBeenCalledWith({
        messageTemplateId: mockTemplate.id,
        name: `${mockTemplate.name} audience`,
      });
      expect(result.clients).toEqual([mockClient]);
    });

    it('replaces the client list on an existing audience', async () => {
      messageTemplatesService.findByTypeOrThrow.mockResolvedValue(mockTemplate);
      const otherClient = { id: 'client-2' } as Client;
      clientsRepository.findBy.mockResolvedValue([otherClient]);
      audiencesRepository.findOne.mockResolvedValue({
        ...mockAudience,
        clients: [mockClient],
      });
      audiencesRepository.save.mockImplementation((audience) =>
        Promise.resolve(audience),
      );

      const result = await service.upsertForType(MessageType.Overdue, [
        'client-2',
      ]);

      expect(audiencesRepository.create).not.toHaveBeenCalled();
      expect(result.clients).toEqual([otherClient]);
    });

    it('sets an empty client list without querying the clients repository', async () => {
      messageTemplatesService.findByTypeOrThrow.mockResolvedValue(mockTemplate);
      audiencesRepository.findOne.mockResolvedValue({
        ...mockAudience,
        clients: [mockClient],
      });
      audiencesRepository.save.mockImplementation((audience) =>
        Promise.resolve(audience),
      );

      const result = await service.upsertForType(MessageType.Overdue, []);

      expect(clientsRepository.findBy).not.toHaveBeenCalled();
      expect(result.clients).toEqual([]);
    });
  });
});
