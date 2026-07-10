import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

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

    const qb = this.installmentsRepository
      .createQueryBuilder('installment')
      .leftJoinAndSelect('installment.loan', 'loan')
      .orderBy('installment.dueDate', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.loanId) {
      qb.andWhere('installment.loanId = :loanId', { loanId: query.loanId });
    }
    if (query.status) {
      qb.andWhere('installment.status = :status', { status: query.status });
    }
    if (query.overdueOnly) {
      qb.andWhere('installment.status = :pendingStatus', {
        pendingStatus: InstallmentStatus.Pending,
      }).andWhere('installment.dueDate < :today', {
        today: new Date().toISOString().slice(0, 10),
      });
    }

    const [items, total] = await qb.getManyAndCount();

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
    const result = await this.paymentsRepository
      .createQueryBuilder('payment')
      .select('COALESCE(SUM(payment.amountPaid), 0)', 'total')
      .where('payment.installmentId = :installmentId', { installmentId })
      .getRawOne<{ total: string }>();

    return parseFloat(result?.total ?? '0');
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
