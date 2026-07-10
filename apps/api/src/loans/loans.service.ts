import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaginatedResult } from '../common/interfaces/paginatedResult.interface';

import { CreateLoanDto } from './dto/createLoan.dto';
import { UpdateLoanDto } from './dto/updateLoan.dto';
import { QueryLoansDto } from './dto/queryLoans.dto';
import { addMonthsToDateString, addWeeksToDateString } from './dueDateSchedule';
import { Installment, InstallmentStatus } from './entities/installment.entity';
import { InstallmentFrequency, Loan, LoanStatus } from './entities/loan.entity';
import {
  enrichInstallment,
  InstallmentWithCalculated,
} from './installments/enrichInstallment';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const POSTGRES_UNIQUE_VIOLATION = '23505';
const AMOUNT_SUM_TOLERANCE = 0.01;

export interface LoanDetail extends Loan {
  installments: InstallmentWithCalculated[];
}

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan)
    private readonly loansRepository: Repository<Loan>,
    @InjectRepository(Installment)
    private readonly installmentsRepository: Repository<Installment>,
  ) {}

  async create(dto: CreateLoanDto): Promise<LoanDetail> {
    await this.assertPromissoryNoteNumberIsUnique(dto.promissoryNoteNumber);
    this.assertInstallmentAmountsMatchPrincipal(
      dto.principalAmount,
      dto.installmentAmounts,
    );

    const loan = this.loansRepository.create({
      clientId: dto.clientId,
      promissoryNoteNumber: dto.promissoryNoteNumber,
      principalAmount: dto.principalAmount,
      interestRate: dto.interestRate,
      disbursedAt: dto.disbursedAt,
      installmentFrequency: dto.installmentFrequency,
      totalInstallments: dto.installmentAmounts.length,
      status: LoanStatus.Active,
    });

    let savedLoan: Loan;
    try {
      savedLoan = await this.loansRepository.save(loan);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }

    const installments = dto.installmentAmounts.map((amount, index) =>
      this.installmentsRepository.create({
        loanId: savedLoan.id,
        installmentNumber: index + 1,
        amount,
        dueDate: this.calculateDueDate(
          dto.disbursedAt,
          dto.installmentFrequency,
          index + 1,
        ),
        status: InstallmentStatus.Pending,
      }),
    );
    await this.installmentsRepository.save(installments);

    return this.findOne(savedLoan.id);
  }

  async findAll(query: QueryLoansDto): Promise<PaginatedResult<Loan>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const qb = this.loansRepository
      .createQueryBuilder('loan')
      .orderBy('loan.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.clientId) {
      qb.andWhere('loan.clientId = :clientId', { clientId: query.clientId });
    }
    if (query.status) {
      qb.andWhere('loan.status = :status', { status: query.status });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<LoanDetail> {
    const loan = await this.findLoanOrThrow(id);

    const installments = await this.installmentsRepository.find({
      where: { loanId: id },
      order: { installmentNumber: 'ASC' },
    });

    return {
      ...loan,
      installments: installments.map((installment) =>
        enrichInstallment(installment, loan.interestRate),
      ),
    };
  }

  async update(id: string, dto: UpdateLoanDto): Promise<Loan> {
    const loan = await this.findLoanOrThrow(id);
    Object.assign(loan, dto);
    return this.loansRepository.save(loan);
  }

  private async findLoanOrThrow(id: string): Promise<Loan> {
    const loan = await this.loansRepository.findOneBy({ id });
    if (!loan) {
      throw new NotFoundException(`Loan with id ${id} not found`);
    }
    return loan;
  }

  private async assertPromissoryNoteNumberIsUnique(
    promissoryNoteNumber: string,
  ): Promise<void> {
    const existing = await this.loansRepository.findOne({
      where: { promissoryNoteNumber },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(
        `A loan with promissory note number ${promissoryNoteNumber} already exists`,
      );
    }
  }

  private assertInstallmentAmountsMatchPrincipal(
    principalAmount: number,
    installmentAmounts: number[],
  ): void {
    const sum = installmentAmounts.reduce((total, amount) => total + amount, 0);
    if (Math.abs(sum - principalAmount) > AMOUNT_SUM_TOLERANCE) {
      throw new BadRequestException(
        `The sum of installment amounts (${sum}) must equal the principal amount (${principalAmount})`,
      );
    }
  }

  private calculateDueDate(
    disbursedAt: string,
    frequency: InstallmentFrequency,
    installmentNumber: number,
  ): string {
    return frequency === InstallmentFrequency.Monthly
      ? addMonthsToDateString(disbursedAt, installmentNumber)
      : addWeeksToDateString(disbursedAt, installmentNumber * 2);
  }

  private mapUniqueViolation(error: unknown): unknown {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === POSTGRES_UNIQUE_VIOLATION
    ) {
      return new ConflictException(
        'A loan with this promissory note number already exists',
      );
    }
    return error;
  }
}
