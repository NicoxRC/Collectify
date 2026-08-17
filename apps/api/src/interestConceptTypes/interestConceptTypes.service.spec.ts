import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import {
  ConceptCalculationType,
  InterestConceptType,
} from './entities/interestConceptType.entity';
import { InterestConceptTypesService } from './interestConceptTypes.service';

describe('InterestConceptTypesService', () => {
  let service: InterestConceptTypesService;
  let repository: {
    find: jest.Mock;
    findOneBy: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const mockConceptType: InterestConceptType = {
    id: 'concept-type-1',
    name: 'Gastos de cobranza',
    defaultCalculationType: ConceptCalculationType.Percentage,
    defaultValue: 3,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    repository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn((dto: Partial<InterestConceptType>) => dto),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InterestConceptTypesService,
        {
          provide: getRepositoryToken(InterestConceptType),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<InterestConceptTypesService>(
      InterestConceptTypesService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns only active types by default', async () => {
      repository.find.mockResolvedValue([mockConceptType]);

      const result = await service.findAll({});

      expect(result).toEqual([mockConceptType]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { name: 'ASC' },
      });
    });

    it('returns deactivated types when isActive=false is requested', async () => {
      repository.find.mockResolvedValue([]);

      await service.findAll({ isActive: false });

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } }),
      );
    });
  });

  describe('create', () => {
    it('creates a concept type with isActive true and a null default value when omitted', async () => {
      repository.save.mockImplementation(
        (entity: Partial<InterestConceptType>) =>
          Promise.resolve({ ...mockConceptType, ...entity }),
      );

      await service.create({
        name: 'Seguro',
        defaultCalculationType: ConceptCalculationType.FixedAmount,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Seguro',
          defaultCalculationType: ConceptCalculationType.FixedAmount,
          defaultValue: null,
          isActive: true,
        }),
      );
    });

    it('persists the provided default value', async () => {
      repository.save.mockImplementation(
        (entity: Partial<InterestConceptType>) =>
          Promise.resolve({ ...mockConceptType, ...entity }),
      );

      await service.create({
        name: 'Interés remuneratorio',
        defaultCalculationType: ConceptCalculationType.Percentage,
        defaultValue: 2,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ defaultValue: 2 }),
      );
    });
  });

  describe('update', () => {
    it('applies only the provided fields', async () => {
      repository.findOneBy.mockResolvedValue({ ...mockConceptType });
      repository.save.mockImplementation((entity: InterestConceptType) =>
        Promise.resolve(entity),
      );

      const result = await service.update('concept-type-1', {
        defaultValue: 5,
      });

      expect(result.defaultValue).toBe(5);
      expect(result.name).toBe(mockConceptType.name);
    });

    it('throws NotFoundException when the type does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('missing-id', { defaultValue: 5 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('sets isActive to false', async () => {
      repository.findOneBy.mockResolvedValue({ ...mockConceptType });
      repository.save.mockImplementation((entity: InterestConceptType) =>
        Promise.resolve(entity),
      );

      const result = await service.deactivate('concept-type-1');

      expect(result.isActive).toBe(false);
    });

    it('throws NotFoundException when the type does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.deactivate('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
