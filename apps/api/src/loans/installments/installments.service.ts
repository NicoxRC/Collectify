import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { And, Equal, FindOptionsWhere, LessThan, Repository } from 'typeorm';

import { PaginatedResult } from '../../common/interfaces/paginatedResult.interface';
import { Installment, InstallmentStatus } from '../entities/installment.entity';
import { Loan, LoanStatus } from '../entities/loan.entity';
import { Payment } from '../entities/payment.entity';

import { CreatePaymentDto } from './dto/createPayment.dto';
import { QueryInstallmentsDto } from './dto/queryInstallments.dto';
import {
  enrichInstallment,
  InstallmentWithCalculated,
} from './enrichInstallment';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

@Injectable()
export class InstallmentsService {
  constructor(
    @InjectRepository(Installment)
    private readonly installmentsRepository: Repository<Installment>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(Loan)
    private readonly loansRepository: Repository<Loan>,
  ) {}

  async findAll(
    query: QueryInstallmentsDto,
  ): Promise<PaginatedResult<InstallmentWithCalculated>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const where: FindOptionsWhere<Installment> = {};
    if (query.loanId) {
      where.loanId = query.loanId;
    }
    if (query.overdueOnly) {
      // Mirrors the previous two `andWhere` calls: status must be Pending
      // AND dueDate must be in the past. If an explicit status filter is
      // also given, both conditions apply — And() preserves that (a status
      // other than 'pending' combined with overdueOnly matches nothing,
      // same as the old chained andWhere clauses would).
      where.status = query.status
        ? And(Equal(query.status), Equal(InstallmentStatus.Pending))
        : InstallmentStatus.Pending;
      where.dueDate = LessThan(new Date().toISOString().slice(0, 10));
    } else if (query.status) {
      where.status = query.status;
    }

    const [items, total] = await this.installmentsRepository.findAndCount({
      where,
      relations: { loan: true },
      order: { dueDate: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((installment) =>
        enrichInstallment(installment, installment.loan.interestRate),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async registerPayment(
    installmentId: string,
    dto: CreatePaymentDto,
  ): Promise<Payment> {
    const installment = await this.installmentsRepository.findOneBy({
      id: installmentId,
    });
    if (!installment) {
      throw new NotFoundException(
        `Installment with id ${installmentId} not found`,
      );
    }

    const payment = this.paymentsRepository.create({
      installmentId,
      amountPaid: dto.amountPaid,
      paidAt: dto.paidAt,
      observation: dto.observation ?? null,
      imageUrl: dto.imageUrl ?? null,
    });
    const savedPayment = await this.paymentsRepository.save(payment);

    if (installment.status === InstallmentStatus.Pending) {
      const totalPaid = await this.sumPayments(installmentId);
      if (totalPaid >= installment.amount) {
        await this.installmentsRepository.update(
          { id: installmentId },
          { status: InstallmentStatus.Paid },
        );
        await this.cascadeLoanStatusIfFullyPaid(installment.loanId);
      }
    }

    return savedPayment;
  }

  private async sumPayments(installmentId: string): Promise<number> {
    const payments = await this.paymentsRepository.find({
      where: { installmentId },
      select: { amountPaid: true },
    });

    return payments.reduce((sum, payment) => sum + payment.amountPaid, 0);
  }

  private async cascadeLoanStatusIfFullyPaid(loanId: string): Promise<void> {
    const installments = await this.installmentsRepository.find({
      where: { loanId },
    });
    const allPaid =
      installments.length > 0 &&
      installments.every(
        (installment) => installment.status === InstallmentStatus.Paid,
      );

    if (!allPaid) {
      return;
    }

    await this.loansRepository.update(
      { id: loanId, status: LoanStatus.Active },
      { status: LoanStatus.Paid },
    );
  }
}
