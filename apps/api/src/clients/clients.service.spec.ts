import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Loan } from '../loans/entities/loan.entity';

import { parseClientsWorkbook } from './clientsImportParser';
import { Client } from './entities/client.entity';
import { ClientsService } from './clients.service';

jest.mock('./clientsImportParser');

const mockParseClientsWorkbook = parseClientsWorkbook as jest.Mock;

describe('ClientsService', () => {
  let service: ClientsService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
    findOne: jest.Mock;
    softDelete: jest.Mock;
    find: jest.Mock;
  };
  let loansRepository: { count: jest.Mock };

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
    repository = {
      create: jest.fn((dto: Partial<Client>) => dto),
      save: jest.fn(),
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      softDelete: jest.fn(),
      find: jest.fn(),
    };
    loansRepository = { count: jest.fn().mockResolvedValue(0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: getRepositoryToken(Client), useValue: repository },
        { provide: getRepositoryToken(Loan), useValue: loansRepository },
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
    it('soft-deletes the client when found and has no loans', async () => {
      repository.findOneBy.mockResolvedValue(mockClient);
      loansRepository.count.mockResolvedValue(0);

      await service.softDelete(mockClient.id);

      expect(loansRepository.count).toHaveBeenCalledWith({
        where: { clientId: mockClient.id },
      });
      expect(repository.softDelete).toHaveBeenCalledWith({ id: mockClient.id });
    });

    it('throws NotFoundException when the client does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.softDelete('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the client has loans, without deleting', async () => {
      repository.findOneBy.mockResolvedValue(mockClient);
      loansRepository.count.mockResolvedValue(2);

      await expect(service.softDelete(mockClient.id)).rejects.toThrow(
        ConflictException,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });
  });

  describe('importFromExcel', () => {
    const buffer = Buffer.from('fake-xlsx');

    beforeEach(() => {
      mockParseClientsWorkbook.mockReset();
    });

    it('creates every valid row and reports the total', async () => {
      mockParseClientsWorkbook.mockResolvedValue({
        rows: [
          {
            row: 2,
            firstName: 'Juana',
            lastName: 'Pérez',
            documentNumber: '1234567890',
            phoneNumber: '+573001234567',
          },
          {
            row: 3,
            firstName: 'Carlos',
            lastName: 'Gomez',
            documentNumber: '9876543210',
            phoneNumber: '+573002222222',
          },
        ],
        errors: [],
      });
      repository.findOne.mockResolvedValue(null);
      repository.save.mockImplementation((client: Partial<Client>) =>
        Promise.resolve({ ...mockClient, ...client }),
      );

      const result = await service.importFromExcel(buffer);

      expect(result).toEqual({ totalRows: 2, created: 2, skipped: [] });
      expect(repository.save).toHaveBeenCalledTimes(2);
    });

    it('carries parse-level row errors straight into skipped', async () => {
      mockParseClientsWorkbook.mockResolvedValue({
        rows: [],
        errors: [{ row: 5, reason: 'Missing value(s) for: lastName' }],
      });

      const result = await service.importFromExcel(buffer);

      expect(result).toEqual({
        totalRows: 1,
        created: 0,
        skipped: [{ row: 5, reason: 'Missing value(s) for: lastName' }],
      });
    });

    it('skips a row that fails DTO validation instead of aborting the import', async () => {
      mockParseClientsWorkbook.mockResolvedValue({
        rows: [
          {
            row: 2,
            firstName: 'Juana',
            lastName: 'Pérez',
            documentNumber: '1234567890',
            phoneNumber: 'not-a-phone-number',
          },
          {
            row: 3,
            firstName: 'Carlos',
            lastName: 'Gomez',
            documentNumber: '9876543210',
            phoneNumber: '+573002222222',
          },
        ],
        errors: [],
      });
      repository.findOne.mockResolvedValue(null);
      repository.save.mockImplementation((client: Partial<Client>) =>
        Promise.resolve({ ...mockClient, ...client }),
      );

      const result = await service.importFromExcel(buffer);

      expect(result.created).toBe(1);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].row).toBe(2);
    });

    it('skips a row whose document number already exists instead of aborting the import', async () => {
      mockParseClientsWorkbook.mockResolvedValue({
        rows: [
          {
            row: 2,
            firstName: 'Juana',
            lastName: 'Pérez',
            documentNumber: '1234567890',
            phoneNumber: '+573001234567',
          },
          {
            row: 3,
            firstName: 'Carlos',
            lastName: 'Gomez',
            documentNumber: '9876543210',
            phoneNumber: '+573002222222',
          },
        ],
        errors: [],
      });
      repository.findOne
        .mockResolvedValueOnce(mockClient) // row 2 — duplicate
        .mockResolvedValueOnce(null); // row 3 — unique
      repository.save.mockImplementation((client: Partial<Client>) =>
        Promise.resolve({ ...mockClient, ...client }),
      );

      const result = await service.importFromExcel(buffer);

      expect(result.created).toBe(1);
      expect(result.skipped).toEqual([
        { row: 2, reason: 'Document number 1234567890 already exists' },
      ]);
    });

    it('wraps a structural parse failure in BadRequestException', async () => {
      mockParseClientsWorkbook.mockRejectedValue(
        new Error('The file is missing required column(s): phoneNumber'),
      );

      await expect(service.importFromExcel(buffer)).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns a paginated page of active clients by default', async () => {
      repository.find.mockResolvedValue([mockClient]);

      const result = await service.findAll({});

      expect(result).toEqual({
        items: [mockClient],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      expect(repository.find).toHaveBeenCalledWith({
        where: {},
        withDeleted: false,
      });
    });

    it('filters to soft-deleted clients when isActive is false', async () => {
      repository.find.mockResolvedValue([]);

      await service.findAll({ isActive: false });

      expect(repository.find).toHaveBeenCalledWith({
        where: {
          deletedAt: expect.objectContaining({ _type: 'not' }) as unknown,
        },
        withDeleted: true,
      });
    });

    it('applies no deletedAt filter at all when isActive is "all"', async () => {
      repository.find.mockResolvedValue([mockClient]);

      await service.findAll({ isActive: 'all' });

      expect(repository.find).toHaveBeenCalledWith({
        where: {},
        withDeleted: true,
      });
    });

    it('applies the search term as an OR across name, document, and phone', async () => {
      repository.find.mockResolvedValue([mockClient]);

      await service.findAll({ search: 'Juana' });

      const [[callArg]] = repository.find.mock.calls as [
        [{ where: Record<string, unknown>[] }],
      ];
      expect(callArg.where).toHaveLength(4);
      for (const condition of callArg.where) {
        const [, operator] = Object.entries(condition).find(
          ([key]) => key !== 'deletedAt',
        )!;
        expect(operator).toMatchObject({ _type: 'ilike', _value: '%Juana%' });
      }
    });

    it('sorts alphabetically by first name then last name, accent- and case-insensitively', async () => {
      const andres = { ...mockClient, id: 'c1', firstName: 'Ándres' };
      const beatriz = { ...mockClient, id: 'c2', firstName: 'beatriz' };
      const carlos = { ...mockClient, id: 'c3', firstName: 'Carlos' };
      repository.find.mockResolvedValue([carlos, andres, beatriz]);

      const result = await service.findAll({});

      expect(result.items.map((client) => client.id)).toEqual([
        'c1',
        'c2',
        'c3',
      ]);
    });

    it('respects custom page and limit', async () => {
      repository.find.mockResolvedValue(
        Array.from({ length: 12 }, (_, i) => ({
          ...mockClient,
          id: `client-${i}`,
        })),
      );

      const result = await service.findAll({ page: 2, limit: 5 });

      expect(result.items).toHaveLength(5);
      expect(result.meta).toEqual({
        page: 2,
        limit: 5,
        total: 12,
        totalPages: 3,
      });
    });
  });
});
