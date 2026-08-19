import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  Installment,
  InstallmentStatus,
} from '../loans/entities/installment.entity';
import { Loan, LoanStatus } from '../loans/entities/loan.entity';

import { parseClientsWorkbook } from './clientsImportParser';
import { ClientsService } from './clients.service';
import { Client, DocumentType } from './entities/client.entity';
import {
  ClientReference,
  ClientReferenceType,
} from './entities/clientReference.entity';

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
    restore: jest.Mock;
  };
  let loansRepository: { count: jest.Mock; find: jest.Mock };
  let installmentsRepository: { find: jest.Mock };
  let clientReferencesRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOneBy: jest.Mock;
    remove: jest.Mock;
  };

  const mockClient: Client = {
    id: 'client-1',
    firstName: 'Juana',
    lastName: 'Pérez',
    documentNumber: '1234567890',
    phoneNumber: '+573001234567',
    creditLimit: null,
    documentType: null,
    dateOfBirth: null,
    documentIssuePlace: null,
    email: null,
    alternatePhoneNumber: null,
    homeAddress: null,
    workAddress: null,
    neighborhood: null,
    city: null,
    occupation: null,
    employerName: null,
    monthlyIncome: null,
    idDocumentFrontUrl: null,
    idDocumentBackUrl: null,
    selfieImageUrl: null,
    dataProcessingConsent: true,
    consentGivenAt: new Date(),
    consentDocumentUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  // enrichInstallment always compares against the real `new Date()` (it
  // doesn't take a `today` param), so any test asserting an exact
  // overdueDays value needs "now" pinned — otherwise a date built from the
  // real clock is one flaky day away from crossing a day boundary mid-run.
  // Fixed at noon UTC; dueDate strings below are always UTC midnight, so
  // there's a comfortable 12h margin on both sides of every day-count
  // assertion, including the >30-days boundary.
  const FIXED_NOW = new Date('2026-06-15T12:00:00Z');
  const daysAgo = (n: number): string => {
    const date = new Date(FIXED_NOW);
    date.setUTCDate(date.getUTCDate() - n);
    return date.toISOString().slice(0, 10);
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((dto: Partial<Client>) => dto),
      save: jest.fn(),
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      softDelete: jest.fn(),
      find: jest.fn(),
      restore: jest.fn(),
    };
    loansRepository = {
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn(),
    };
    installmentsRepository = { find: jest.fn() };
    clientReferencesRepository = {
      create: jest.fn((dto: Partial<ClientReference>) => dto),
      save: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClientsService,
        { provide: getRepositoryToken(Client), useValue: repository },
        { provide: getRepositoryToken(Loan), useValue: loansRepository },
        {
          provide: getRepositoryToken(Installment),
          useValue: installmentsRepository,
        },
        {
          provide: getRepositoryToken(ClientReference),
          useValue: clientReferencesRepository,
        },
      ],
    }).compile();

    service = module.get<ClientsService>(ClientsService);

    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('create', () => {
    const createDto = {
      firstName: 'Juana',
      lastName: 'Pérez',
      documentNumber: '1234567890',
      phoneNumber: '+573001234567',
      documentType: DocumentType.CedulaCiudadania,
      dataProcessingConsent: true,
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

    // Phase 21 — dataProcessingConsent is required through this path
    // (ClientsController.create), never through importFromExcel. See
    // docs/phases/PHASE_21_CLIENT_PROFILE.md decision 6.
    it('rejects creating a client without data-processing consent', async () => {
      await expect(
        service.create({ ...createDto, dataProcessingConsent: false }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rejects creating a client when consent is omitted entirely', async () => {
      const withoutConsent = {
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        documentNumber: createDto.documentNumber,
        phoneNumber: createDto.phoneNumber,
      };

      await expect(service.create(withoutConsent)).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    // Client requested this be mandatory on the interactive create path,
    // same requireX/Excel-exempt pattern as dataProcessingConsent above.
    it('rejects creating a client without a document type', async () => {
      const withoutDocumentType = {
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        documentNumber: createDto.documentNumber,
        phoneNumber: createDto.phoneNumber,
        dataProcessingConsent: createDto.dataProcessingConsent,
      };

      await expect(service.create(withoutDocumentType)).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('does not require a document type when explicitly opted out (Excel import path)', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.save.mockResolvedValue(mockClient);

      const withoutDocumentType = {
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        documentNumber: createDto.documentNumber,
        phoneNumber: createDto.phoneNumber,
      };
      await expect(
        service.create(withoutDocumentType, {
          requireConsent: false,
          requireDocumentType: false,
        }),
      ).resolves.toEqual(mockClient);
    });

    it('stamps consentGivenAt with the server clock when consent is given', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.save.mockImplementation((client: Partial<Client>) =>
        Promise.resolve({ ...mockClient, ...client }),
      );

      await service.create(createDto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ consentGivenAt: FIXED_NOW }),
      );
    });

    it('does not require consent when explicitly opted out (Excel import path)', async () => {
      repository.findOne.mockResolvedValue(null);
      repository.save.mockResolvedValue(mockClient);

      const withoutConsent = {
        firstName: createDto.firstName,
        lastName: createDto.lastName,
        documentNumber: createDto.documentNumber,
        phoneNumber: createDto.phoneNumber,
      };
      await expect(
        service.create(withoutConsent, { requireConsent: false }),
      ).resolves.toEqual(mockClient);
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

    // Phase 21 — consentGivenAt is stamped with the server clock only when
    // consent actually transitions to true, not on every unrelated update.
    it('stamps consentGivenAt when consent newly transitions to true', async () => {
      repository.findOneBy.mockResolvedValue({
        ...mockClient,
        dataProcessingConsent: false,
        consentGivenAt: null,
      });
      repository.save.mockImplementation((client: Client) =>
        Promise.resolve(client),
      );

      const result = await service.update(mockClient.id, {
        dataProcessingConsent: true,
      });

      expect(result.consentGivenAt).toEqual(FIXED_NOW);
    });

    it('does not touch consentGivenAt when consent was already true', async () => {
      const alreadyGivenAt = new Date('2026-01-01T00:00:00Z');
      repository.findOneBy.mockResolvedValue({
        ...mockClient,
        dataProcessingConsent: true,
        consentGivenAt: alreadyGivenAt,
      });
      repository.save.mockImplementation((client: Client) =>
        Promise.resolve(client),
      );

      const result = await service.update(mockClient.id, {
        firstName: 'Juanita',
      });

      expect(result.consentGivenAt).toEqual(alreadyGivenAt);
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

  // "Cupo usado" = capital + interés acumulado across still-pending
  // installments on the client's active loans, per the confirmed rule in
  // docs/phases/PHASE_10_CLIENT_CAPACITY.md / docs/DATABASE.md.
  describe('getCreditUsage', () => {
    it('returns zero used and full cupo available when the client has no active loans', async () => {
      repository.findOneBy.mockResolvedValue({
        ...mockClient,
        creditLimit: 1000,
      });
      loansRepository.find.mockResolvedValue([]);

      const result = await service.getCreditUsage(mockClient.id);

      expect(result).toEqual({
        creditLimit: 1000,
        creditUsed: 0,
        creditAvailable: 1000,
      });
      expect(installmentsRepository.find).not.toHaveBeenCalled();
    });

    it('sums amount (no accrued interest) for pending installments that are not yet due', async () => {
      repository.findOneBy.mockResolvedValue({
        ...mockClient,
        creditLimit: 1000,
      });
      loansRepository.find.mockResolvedValue([
        { id: 'loan-1', clientId: mockClient.id, interestRate: 2 },
      ]);
      installmentsRepository.find.mockResolvedValue([
        {
          id: 'inst-1',
          loanId: 'loan-1',
          amount: 300,
          dueDate: daysAgo(-10), // still 10 days out
          status: InstallmentStatus.Pending,
        },
      ]);

      const result = await service.getCreditUsage(mockClient.id);

      expect(result).toEqual({
        creditLimit: 1000,
        creditUsed: 300,
        creditAvailable: 700,
      });
    });

    it('adds accrued interest for overdue pending installments', async () => {
      repository.findOneBy.mockResolvedValue({
        ...mockClient,
        creditLimit: 1000,
      });
      loansRepository.find.mockResolvedValue([
        { id: 'loan-1', clientId: mockClient.id, interestRate: 3 },
      ]);
      installmentsRepository.find.mockResolvedValue([
        {
          id: 'inst-1',
          loanId: 'loan-1',
          amount: 300,
          dueDate: daysAgo(10),
          status: InstallmentStatus.Pending,
        },
      ]);

      const result = await service.getCreditUsage(mockClient.id);

      // 300 + (300 * 0.03 / 30) * 10 = 300 + 3 = 303
      expect(result.creditUsed).toBeCloseTo(303);
      expect(result.creditAvailable).toBeCloseTo(697);
    });

    it('ignores paid and cancelled installments', async () => {
      repository.findOneBy.mockResolvedValue({
        ...mockClient,
        creditLimit: 1000,
      });
      loansRepository.find.mockResolvedValue([
        { id: 'loan-1', clientId: mockClient.id, interestRate: 2 },
      ]);
      installmentsRepository.find.mockResolvedValue([
        {
          id: 'inst-1',
          loanId: 'loan-1',
          amount: 300,
          dueDate: daysAgo(10),
          status: InstallmentStatus.Paid,
        },
        {
          id: 'inst-2',
          loanId: 'loan-1',
          amount: 300,
          dueDate: daysAgo(10),
          status: InstallmentStatus.Cancelled,
        },
      ]);

      const result = await service.getCreditUsage(mockClient.id);

      expect(result.creditUsed).toBe(0);
    });

    it('returns null creditAvailable when the client has no cupo set', async () => {
      repository.findOneBy.mockResolvedValue({
        ...mockClient,
        creditLimit: null,
      });
      loansRepository.find.mockResolvedValue([]);

      const result = await service.getCreditUsage(mockClient.id);

      expect(result).toEqual({
        creditLimit: null,
        creditUsed: 0,
        creditAvailable: null,
      });
    });

    it('only counts loans that are Active, excluding refinanced/paid loans', async () => {
      repository.findOneBy.mockResolvedValue({
        ...mockClient,
        creditLimit: 1000,
      });
      // The service filters by status: Active in its query — this asserts
      // that filter is actually applied, not just documented.
      loansRepository.find.mockResolvedValue([]);

      await service.getCreditUsage(mockClient.id);

      expect(loansRepository.find).toHaveBeenCalledWith({
        where: { clientId: mockClient.id, status: LoanStatus.Active },
      });
    });
  });

  // Per-installment, not client-aggregate — confirmed with the human for
  // Phase 10 (see docs/phases/PHASE_10_CLIENT_CAPACITY.md).
  describe('hasMoraBlock', () => {
    it('is false when the client has no active loans', async () => {
      loansRepository.find.mockResolvedValue([]);

      expect(await service.hasMoraBlock(mockClient.id)).toBe(false);
    });

    it('is false when every pending installment is 30 days overdue or less', async () => {
      loansRepository.find.mockResolvedValue([
        { id: 'loan-1', clientId: mockClient.id, interestRate: 2 },
      ]);
      installmentsRepository.find.mockResolvedValue([
        {
          id: 'inst-1',
          loanId: 'loan-1',
          amount: 300,
          dueDate: daysAgo(30),
          status: InstallmentStatus.Pending,
        },
      ]);

      expect(await service.hasMoraBlock(mockClient.id)).toBe(false);
    });

    it('is true when any single pending installment is more than 30 days overdue', async () => {
      loansRepository.find.mockResolvedValue([
        { id: 'loan-1', clientId: mockClient.id, interestRate: 2 },
        { id: 'loan-2', clientId: mockClient.id, interestRate: 2 },
      ]);
      installmentsRepository.find.mockResolvedValue([
        {
          id: 'inst-1',
          loanId: 'loan-1',
          amount: 300,
          dueDate: daysAgo(5),
          status: InstallmentStatus.Pending,
        },
        {
          id: 'inst-2',
          loanId: 'loan-2',
          amount: 300,
          dueDate: daysAgo(31),
          status: InstallmentStatus.Pending,
        },
      ]);

      expect(await service.hasMoraBlock(mockClient.id)).toBe(true);
    });

    it('ignores an overdue installment on a refinanced-away (non-Active) loan', async () => {
      // The service only fetches loans with status: Active, so a refinanced
      // loan's old overdue installments never reach this point.
      loansRepository.find.mockResolvedValue([]);

      expect(await service.hasMoraBlock(mockClient.id)).toBe(false);
      expect(installmentsRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('findOneDetail', () => {
    it('includes creditUsed, creditAvailable, isMoraBlocked and references alongside the client fields', async () => {
      repository.findOneBy.mockResolvedValue({
        ...mockClient,
        creditLimit: 1000,
      });
      loansRepository.find.mockResolvedValue([
        { id: 'loan-1', clientId: mockClient.id, interestRate: 2 },
      ]);
      installmentsRepository.find.mockResolvedValue([
        {
          id: 'inst-1',
          loanId: 'loan-1',
          amount: 300,
          dueDate: daysAgo(35),
          status: InstallmentStatus.Pending,
        },
      ]);
      const mockReference: ClientReference = {
        id: 'reference-1',
        clientId: mockClient.id,
        client: {} as never,
        type: ClientReferenceType.Personal,
        fullName: 'Carlos Gómez',
        phoneNumber: '+573001112233',
        relationship: 'Hermano',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      clientReferencesRepository.find.mockResolvedValue([mockReference]);

      const result = await service.findOneDetail(mockClient.id);

      expect(result.id).toBe(mockClient.id);
      expect(result.creditAvailable).toBeLessThan(1000);
      expect(result.isMoraBlocked).toBe(true);
      expect(result.references).toEqual([mockReference]);
      expect(clientReferencesRepository.find).toHaveBeenCalledWith({
        where: { clientId: mockClient.id },
        order: { createdAt: 'ASC' },
      });
    });

    it('throws NotFoundException when the client does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findOneDetail('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // Phase 21 — a dynamic add/remove list, no fixed min/max. See
  // docs/phases/PHASE_21_CLIENT_PROFILE.md.
  describe('references', () => {
    const referenceDto = {
      type: ClientReferenceType.Personal,
      fullName: 'Carlos Gómez',
      phoneNumber: '+573001112233',
      relationship: 'Hermano',
    };
    const mockReference: ClientReference = {
      id: 'reference-1',
      clientId: mockClient.id,
      client: {} as never,
      ...referenceDto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    describe('addReference', () => {
      it('adds a reference to an existing client', async () => {
        repository.findOneBy.mockResolvedValue(mockClient);
        clientReferencesRepository.save.mockResolvedValue(mockReference);

        const result = await service.addReference(mockClient.id, referenceDto);

        expect(result).toEqual(mockReference);
        expect(clientReferencesRepository.create).toHaveBeenCalledWith({
          ...referenceDto,
          clientId: mockClient.id,
        });
      });

      it('throws NotFoundException when the client does not exist', async () => {
        repository.findOneBy.mockResolvedValue(null);

        await expect(
          service.addReference('missing-id', referenceDto),
        ).rejects.toThrow(NotFoundException);
        expect(clientReferencesRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('updateReference', () => {
      it('updates a reference that belongs to the given client', async () => {
        clientReferencesRepository.findOneBy.mockResolvedValue(mockReference);
        clientReferencesRepository.save.mockResolvedValue({
          ...mockReference,
          fullName: 'Carlos Andrés Gómez',
        });

        const result = await service.updateReference(
          mockClient.id,
          mockReference.id,
          { fullName: 'Carlos Andrés Gómez' },
        );

        expect(result.fullName).toBe('Carlos Andrés Gómez');
        expect(clientReferencesRepository.findOneBy).toHaveBeenCalledWith({
          id: mockReference.id,
          clientId: mockClient.id,
        });
      });

      it('throws NotFoundException when the reference does not exist for that client', async () => {
        clientReferencesRepository.findOneBy.mockResolvedValue(null);

        await expect(
          service.updateReference(mockClient.id, 'missing-reference', {
            fullName: 'X',
          }),
        ).rejects.toThrow(NotFoundException);
        expect(clientReferencesRepository.save).not.toHaveBeenCalled();
      });
    });

    describe('removeReference', () => {
      it('removes a reference that belongs to the given client', async () => {
        clientReferencesRepository.findOneBy.mockResolvedValue(mockReference);

        await service.removeReference(mockClient.id, mockReference.id);

        expect(clientReferencesRepository.remove).toHaveBeenCalledWith(
          mockReference,
        );
      });

      it('throws NotFoundException when the reference does not exist for that client', async () => {
        clientReferencesRepository.findOneBy.mockResolvedValue(null);

        await expect(
          service.removeReference(mockClient.id, 'missing-reference'),
        ).rejects.toThrow(NotFoundException);
        expect(clientReferencesRepository.remove).not.toHaveBeenCalled();
      });
    });
  });

  describe('reactivate', () => {
    it('restores a soft-deleted client', async () => {
      const deletedClient = { ...mockClient, deletedAt: new Date() };
      repository.findOne.mockResolvedValue(deletedClient);
      repository.findOneBy.mockResolvedValue(mockClient);

      const result = await service.reactivate(mockClient.id);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: mockClient.id },
        withDeleted: true,
      });
      expect(repository.restore).toHaveBeenCalledWith({ id: mockClient.id });
      expect(result).toEqual(mockClient);
    });

    it('throws NotFoundException when the client does not exist at all', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.reactivate('missing-id')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.restore).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the client is already active', async () => {
      repository.findOne.mockResolvedValue(mockClient);

      await expect(service.reactivate(mockClient.id)).rejects.toThrow(
        BadRequestException,
      );
      expect(repository.restore).not.toHaveBeenCalled();
    });
  });
});
