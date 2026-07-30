import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindOptionsWhere, ILike, IsNull, Not, Repository } from 'typeorm';

import { PaginatedResult } from '../common/interfaces/paginatedResult.interface';
import { Loan } from '../loans/entities/loan.entity';

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
    @InjectRepository(Loan)
    private readonly loansRepository: Repository<Loan>,
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

  // Alphabetical by name instead of most-recently-created, per the
  // client's request. firstName/lastName are free text (nothing stops
  // someone from entering "Juan Carlos" as a first name and "Pérez
  // Gómez" as a last name) — that's not actually a problem for text
  // ordering the way it was for promissoryNoteNumber's numbers: strings
  // of different lengths compare correctly character by character
  // regardless of how many "names" are packed into the field (e.g.
  // "Juan" sorts before "Juan Carlos", same as "casa" before "casas").
  //
  // Sorted in application code (fetching every matching row, unpaginated,
  // then slicing the page) rather than at the database level: the sort
  // key here is computed (case- and accent-folded), and Postgres — with no
  // locale-aware/ICU collation configured on this database (confirmed
  // empirically: the client tested "José" vs "Jose" and "Ñoño" vs
  // "Nn"/"Oo") — compares text by raw UTF-8 byte value, so every accented
  // name would otherwise sort after all plain ASCII ones. Folding each
  // accented character to its plain equivalent (only for sort purposes —
  // the stored/displayed name is untouched) reproduces the same ordering
  // without a database-side function. At this business's scale (a single
  // lending company's client list, not a multi-tenant SaaS), fetching the
  // filtered set before paginating is not a performance concern.
  async findAll(query: QueryClientsDto): Promise<PaginatedResult<Client>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const matches = await this.clientsRepository.find({
      where: this.buildFindAllWhere(query),
      // 'all' and false both need soft-deleted rows visible — 'all' shows
      // everything, false is filtered down to only soft-deleted rows below.
      withDeleted: query.isActive === 'all' || query.isActive === false,
    });
    const items = matches.sort(compareClientsByName);

    const total = items.length;
    const start = (page - 1) * limit;

    return {
      items: items.slice(start, start + limit),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // 'all' means no filter at all (both active and soft-deleted). Any
  // other value — including omitted, defaulting to true — filters as
  // before; see queryClients.dto.ts's Transform for how 'all' gets here.
  private buildFindAllWhere(
    query: QueryClientsDto,
  ): FindOptionsWhere<Client> | FindOptionsWhere<Client>[] {
    const base: FindOptionsWhere<Client> = {};
    if (query.isActive === false) {
      base.deletedAt = Not(IsNull());
    }

    if (!query.search) {
      return base;
    }

    const search = ILike(`%${query.search}%`);
    return [
      { ...base, firstName: search },
      { ...base, lastName: search },
      { ...base, documentNumber: search },
      { ...base, phoneNumber: search },
    ];
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

    const loanCount = await this.loansRepository.count({
      where: { clientId: id },
    });
    if (loanCount > 0) {
      throw new ConflictException(
        'No se puede eliminar un cliente que tiene préstamos asociados.',
      );
    }

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

// Mirrors TRANSLATE(LOWER(x), 'áéíóúñü', 'aeiounu') from the previous
// SQL-level sort. Doesn't reproduce the traditional Spanish-dictionary rule
// of treating "ñ" as its own letter between "n" and "o" — it folds to "n" —
// but that's a minor imprecision next to the alternative of ñ-named clients
// always sorting dead last (see findAll's comment for why that matters here).
const ACCENT_FOLD: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ú: 'u',
  ñ: 'n',
  ü: 'u',
};

function foldForSort(value: string): string {
  return value.toLowerCase().replace(/[áéíóúñü]/g, (char) => ACCENT_FOLD[char]);
}

// Plain `<`/`>` on the folded strings, not localeCompare(): the previous
// SQL sort compared raw byte value, which for the ASCII range left after
// folding is equivalent to comparing UTF-16 code units directly —
// localeCompare's locale-aware rules could reorder differently.
function compareClientsByName(a: Client, b: Client): number {
  const firstNameCompare = compareFolded(a.firstName, b.firstName);
  if (firstNameCompare !== 0) {
    return firstNameCompare;
  }
  return compareFolded(a.lastName, b.lastName);
}

function compareFolded(a: string, b: string): number {
  const foldedA = foldForSort(a);
  const foldedB = foldForSort(b);
  if (foldedA < foldedB) {
    return -1;
  }
  if (foldedA > foldedB) {
    return 1;
  }
  return 0;
}
