import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PaginatedResult } from '../common/interfaces/paginatedResult.interface';

import { UpdateLoanDto } from './dto/updateLoan.dto';
import { QueryLoansDto } from './dto/queryLoans.dto';
import { Installment } from './entities/installment.entity';
import { Loan } from './entities/loan.entity';
import {
  enrichInstallment,
  InstallmentWithCalculated,
} from './installments/enrichInstallment';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

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
}
