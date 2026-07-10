import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaginatedResult } from '../common/interfaces/paginatedResult.interface';

import { CreateClientDto } from './dto/createClient.dto';
import { QueryClientsDto } from './dto/queryClients.dto';
import { UpdateClientDto } from './dto/updateClient.dto';
import { Client } from './entities/client.entity';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private readonly clientsRepository: Repository<Client>,
  ) {}

  async create(dto: CreateClientDto): Promise<Client> {
    await this.assertDocumentNumberIsUnique(dto.documentNumber);

    const client = this.clientsRepository.create(dto);
    try {
      return await this.clientsRepository.save(client);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async findAll(query: QueryClientsDto): Promise<PaginatedResult<Client>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const isActive = query.isActive ?? true;

    const qb = this.clientsRepository
      .createQueryBuilder('client')
      .withDeleted()
      .andWhere(
        isActive ? 'client.deletedAt IS NULL' : 'client.deletedAt IS NOT NULL',
      )
      .orderBy('client.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.search) {
      qb.andWhere(
        '(client.firstName ILIKE :search OR client.lastName ILIKE :search OR client.documentNumber ILIKE :search OR client.phoneNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Client> {
    const client = await this.clientsRepository.findOneBy({ id });
    if (!client) {
      throw new NotFoundException(`Client with id ${id} not found`);
    }
    return client;
  }

  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    const client = await this.findOne(id);

    if (dto.documentNumber && dto.documentNumber !== client.documentNumber) {
      await this.assertDocumentNumberIsUnique(dto.documentNumber);
    }

    Object.assign(client, dto);
    try {
      return await this.clientsRepository.save(client);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.findOne(id);
    await this.clientsRepository.softDelete({ id });
  }

  private async assertDocumentNumberIsUnique(
    documentNumber: string,
  ): Promise<void> {
    const existing = await this.clientsRepository.findOne({
      where: { documentNumber },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(
        `A client with document number ${documentNumber} already exists`,
      );
    }
  }

  private mapUniqueViolation(error: unknown): unknown {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === POSTGRES_UNIQUE_VIOLATION
    ) {
      return new ConflictException(
        'A client with this document number already exists',
      );
    }
    return error;
  }
}
