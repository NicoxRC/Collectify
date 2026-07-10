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
import { RefinanceLoanDto } from './dto/refinanceLoan.dto';
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
  // Computed reverse lookup, not a stored column — the loan this one was
  // later refinanced into, if any. See docs/phases/PHASE_6_REFINANCING.md.
  refinancedToLoanId: string | null;
}

interface PersistLoanParams {
  clientId: string;
  promissoryNoteNumber: string;
  principalAmount: number;
  interestRate: number;
  disbursedAt: string;
  installmentFrequency: InstallmentFrequency;
  installmentAmounts: number[];
  refinancedFromLoanId?: string | null;
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
    const savedLoan = await this.persistLoanWithInstallments({
      clientId: dto.clientId,
      promissoryNoteNumber: dto.promissoryNoteNumber,
      principalAmount: dto.principalAmount,
      interestRate: dto.interestRate,
      disbursedAt: dto.disbursedAt,
      installmentFrequency: dto.installmentFrequency,
      installmentAmounts: dto.installmentAmounts,
    });

    return this.findOne(savedLoan.id);
  }

  // Closes out the old loan, cancels whatever installments it still had
  // pending (excluded from active collection but kept as historical
  // record — the confirmed behavior, see docs/DATABASE.md "Refinancing"),
  // and opens a new loan in its place linked via refinancedFromLoanId.
  async refinance(id: string, dto: RefinanceLoanDto): Promise<LoanDetail> {
    const oldLoan = await this.findLoanOrThrow(id);
    if (oldLoan.status !== LoanStatus.Active) {
      throw new BadRequestException(
        `Loan ${id} cannot be refinanced because its status is '${oldLoan.status}' — only active loans can be refinanced`,
      );
    }

    oldLoan.status = LoanStatus.Refinanced;
    await this.loansRepository.save(oldLoan);

    await this.installmentsRepository.update(
      { loanId: id, status: InstallmentStatus.Pending },
      { status: InstallmentStatus.Cancelled },
    );

    const newLoan = await this.persistLoanWithInstallments({
      clientId: oldLoan.clientId,
      promissoryNoteNumber: dto.promissoryNoteNumber,
      principalAmount: dto.principalAmount,
      interestRate: dto.interestRate,
      disbursedAt: dto.disbursedAt,
      installmentFrequency: dto.installmentFrequency,
      installmentAmounts: dto.installmentAmounts,
      refinancedFromLoanId: id,
    });

    return this.findOne(newLoan.id);
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

    const refinancedTo = await this.loansRepository.findOne({
      where: { refinancedFromLoanId: id },
    });

    return {
      ...loan,
      installments: installments.map((installment) =>
        enrichInstallment(installment, loan.interestRate),
      ),
      refinancedToLoanId: refinancedTo?.id ?? null,
    };
  }

  async update(id: string, dto: UpdateLoanDto): Promise<Loan> {
    const loan = await this.findLoanOrThrow(id);
    Object.assign(loan, dto);
    return this.loansRepository.save(loan);
  }

  // Shared by create() and refinance() — both need a loan row plus its
  // generated installments, differing only in whether refinancedFromLoanId
  // is set.
  private async persistLoanWithInstallments(
    params: PersistLoanParams,
  ): Promise<Loan> {
    await this.assertPromissoryNoteNumberIsUnique(params.promissoryNoteNumber);
    this.assertInstallmentAmountsMatchPrincipal(
      params.principalAmount,
      params.installmentAmounts,
    );

    const loan = this.loansRepository.create({
      clientId: params.clientId,
      promissoryNoteNumber: params.promissoryNoteNumber,
      principalAmount: params.principalAmount,
      interestRate: params.interestRate,
      disbursedAt: params.disbursedAt,
      installmentFrequency: params.installmentFrequency,
      totalInstallments: params.installmentAmounts.length,
      status: LoanStatus.Active,
      refinancedFromLoanId: params.refinancedFromLoanId ?? null,
    });

    let savedLoan: Loan;
    try {
      savedLoan = await this.loansRepository.save(loan);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }

    const installments = params.installmentAmounts.map((amount, index) =>
      this.installmentsRepository.create({
        loanId: savedLoan.id,
        installmentNumber: index + 1,
        amount,
        dueDate: this.calculateDueDate(
          params.disbursedAt,
          params.installmentFrequency,
          index + 1,
        ),
        status: InstallmentStatus.Pending,
      }),
    );
    await this.installmentsRepository.save(installments);

    return savedLoan;
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
