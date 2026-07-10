import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Repository } from 'typeorm';

import { PaginatedResult } from '../common/interfaces/paginatedResult.interface';

import {
  ParsedClientRow,
  parseClientsWorkbook,
  RowError,
} from './clientsImportParser';
import { CreateClientDto } from './dto/createClient.dto';
import { QueryClientsDto } from './dto/queryClients.dto';
import { UpdateClientDto } from './dto/updateClient.dto';
import { Client } from './entities/client.entity';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const POSTGRES_UNIQUE_VIOLATION = '23505';

export interface ImportClientsResult {
  totalRows: number;
  created: number;
  skipped: RowError[];
}

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

  // Bulk onboarding from the client's own Excel process (see
  // docs/PROJECT_ROADMAP.md Phase 8, confirmed still needed). A bad row
  // (invalid data or a duplicate document number) is skipped and reported,
  // not aborted — one bad row shouldn't sink the rest of a real spreadsheet.
  // Reuses create()'s validation and uniqueness logic per row, same as a
  // manual create would.
  async importFromExcel(buffer: Buffer): Promise<ImportClientsResult> {
    let parsed: { rows: ParsedClientRow[]; errors: RowError[] };
    try {
      parsed = await parseClientsWorkbook(buffer);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Could not parse the uploaded file',
      );
    }

    const skipped: RowError[] = [...parsed.errors];
    let created = 0;

    for (const row of parsed.rows) {
      const dto = plainToInstance(CreateClientDto, {
        firstName: row.firstName,
        lastName: row.lastName,
        documentNumber: row.documentNumber,
        phoneNumber: row.phoneNumber,
      });

      const validationErrors = await validate(dto);
      if (validationErrors.length > 0) {
        skipped.push({
          row: row.row,
          reason: validationErrors
            .flatMap((error) => Object.values(error.constraints ?? {}))
            .join('; '),
        });
        continue;
      }

      try {
        await this.create(dto);
        created += 1;
      } catch (error) {
        if (error instanceof ConflictException) {
          skipped.push({
            row: row.row,
            reason: `Document number ${dto.documentNumber} already exists`,
          });
        } else {
          throw error;
        }
      }
    }

    return {
      totalRows: parsed.rows.length + parsed.errors.length,
      created,
      skipped,
    };
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
