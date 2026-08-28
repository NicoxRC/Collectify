import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateInterestConceptTypeDto } from './dto/createInterestConceptType.dto';
import { QueryInterestConceptTypesDto } from './dto/queryInterestConceptTypes.dto';
import { UpdateInterestConceptTypeDto } from './dto/updateInterestConceptType.dto';
import { InterestConceptType } from './entities/interestConceptType.entity';

@Injectable()
export class InterestConceptTypesService {
  constructor(
    @InjectRepository(InterestConceptType)
    private readonly repository: Repository<InterestConceptType>,
  ) {}

  findAll(query: QueryInterestConceptTypesDto): Promise<InterestConceptType[]> {
    const isActive = query.isActive ?? true;

    return this.repository.find({
      where: { isActive },
      order: { name: 'ASC' },
    });
  }

  async findOneOrThrow(id: string): Promise<InterestConceptType> {
    const conceptType = await this.repository.findOneBy({ id });
    if (!conceptType) {
      throw new NotFoundException(
        `Interest concept type with id ${id} not found`,
      );
    }
    return conceptType;
  }

  create(dto: CreateInterestConceptTypeDto): Promise<InterestConceptType> {
    const conceptType = this.repository.create({
      name: dto.name,
      defaultCalculationType: dto.defaultCalculationType,
      defaultValue: dto.defaultValue ?? null,
      category: dto.category,
      fixedAmountDistribution: dto.fixedAmountDistribution ?? null,
      isActive: true,
    });
    return this.repository.save(conceptType);
  }

  async update(
    id: string,
    dto: UpdateInterestConceptTypeDto,
  ): Promise<InterestConceptType> {
    const conceptType = await this.findOneOrThrow(id);

    if (dto.name !== undefined) conceptType.name = dto.name;
    if (dto.defaultCalculationType !== undefined) {
      conceptType.defaultCalculationType = dto.defaultCalculationType;
    }
    if (dto.defaultValue !== undefined) {
      conceptType.defaultValue = dto.defaultValue;
    }
    if (dto.category !== undefined) {
      conceptType.category = dto.category;
    }
    if (dto.fixedAmountDistribution !== undefined) {
      conceptType.fixedAmountDistribution = dto.fixedAmountDistribution;
    }

    return this.repository.save(conceptType);
  }

  // Removing a type from the picker for new loans, without touching
  // LoanInstallmentConcept rows already generated from it (those snapshot
  // their own name/value — see docs/phases/PHASE_14_INTEREST_CONCEPTS.md).
  async deactivate(id: string): Promise<InterestConceptType> {
    const conceptType = await this.findOneOrThrow(id);
    conceptType.isActive = false;
    return this.repository.save(conceptType);
  }
}
