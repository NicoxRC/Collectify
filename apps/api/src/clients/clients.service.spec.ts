import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Client } from './entities/client.entity';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  let service: ClientsService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    findOne: jest.Mock;
    softDelete: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queryBuilder: {
    withDeleted: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  const mockClient: Client = {
    id: 'client-1',
    firstName: 'Juana',
    lastName: 'Pérez',
    documentNumber: '1234567890',
    phoneNumber: '+573001234567',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    queryBuilder = {
      withDeleted: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    repository = {
      create: jest.fn((dto: Partial<Client>) => dto),
      save: jest.fn(),
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      softDelete: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: getRepositoryToken(Client), useValue: repository },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);
  });

  describe('create', () => {
    const createDto = {
      firstName: 'Juana',
      lastName: 'Pérez',
      documentNumber: '1234567890',
      phoneNumber: '+573001234567',
    };

    it('creates a client when the document number is not in use', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.save.mockResolvedValue(mockClient);

      const result = await service.create(createDto);

      expect(result).toEqual(mockClient);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { documentNumber: createDto.documentNumber },
        withDeleted: true,
      });
    });

    it('rejects a duplicate document number with ConflictException, not a raw DB error', async () => {
      repository.findOne.mockResolvedValue(mockClient);

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the client when found', async () => {
      repository.findOneBy.mockResolvedValue(mockClient);

      const result = await service.findOne(mockClient.id);

      expect(result).toEqual(mockClient);
    });

    it('throws NotFoundException when the client does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates the client when found and the document number is unchanged', async () => {
      repository.findOneBy.mockResolvedValue(mockClient);
      repository.save.mockResolvedValue({
        ...mockClient,
        firstName: 'Juanita',
      });

      const result = await service.update(mockClient.id, {
        firstName: 'Juanita',
      });

      expect(result.firstName).toBe('Juanita');
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the client does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('missing-id', { firstName: 'Juanita' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects updating to a document number already used by another client', async () => {
      repository.findOneBy.mockResolvedValue(mockClient);
      repository.findOne.mockResolvedValue({
        ...mockClient,
        id: 'other-client',
      });

      await expect(
        service.update(mockClient.id, { documentNumber: '9999999999' }),
      ).rejects.toThrow(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('soft-deletes the client when found', async () => {
      repository.findOneBy.mockResolvedValue(mockClient);

      await service.softDelete(mockClient.id);

      expect(repository.softDelete).toHaveBeenCalledWith({ id: mockClient.id });
    });

    it('throws NotFoundException when the client does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.softDelete('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns a paginated page of active clients by default', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[mockClient], 1]);

      const result = await service.findAll({});

      expect(result).toEqual({
        items: [mockClient],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'client.deletedAt IS NULL',
      );
    });

    it('filters to soft-deleted clients when isActive is false', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ isActive: false });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'client.deletedAt IS NOT NULL',
      );
    });

    it('applies the search term across name, document, and phone', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[mockClient], 1]);

      await service.findAll({ search: 'Juana' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        { search: '%Juana%' },
      );
    });

    it('respects custom page and limit', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 2, limit: 5 });

      expect(queryBuilder.skip).toHaveBeenCalledWith(5);
      expect(queryBuilder.take).toHaveBeenCalledWith(5);
    });
  });
});
