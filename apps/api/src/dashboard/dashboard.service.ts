import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { endOfWeek, startOfWeek } from 'date-fns';
import { Between, LessThan, Repository } from 'typeorm';

import { PaginatedResult } from '../common/interfaces/paginatedResult.interface';
import {
  Installment,
  InstallmentStatus,
} from '../loans/entities/installment.entity';
import { Loan, LoanStatus } from '../loans/entities/loan.entity';
import { Payment } from '../loans/entities/payment.entity';
import { enrichInstallment } from '../loans/installments/enrichInstallment';
import { MessageLog } from '../whatsapp/entities/messageLog.entity';

import { MonthlyReportQueryDto } from './dto/monthlyReportQuery.dto';
import {
  OverdueClientsSortBy,
  QueryOverdueClientsDto,
} from './dto/queryOverdueClients.dto';
import { monthBoundaries } from './monthBoundaries';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const WEEK_STARTS_ON_MONDAY = 1;

export interface DashboardSummary {
  totalActiveClients: number;
  totalOverdueInstallments: number;
  totalAmountOverdue: number;
  messagesSentThisWeek: number;
}

export interface OverdueClientSummary {
  clientId: string;
  firstName: string;
  lastName: string;
  totalOverdueAmount: number;
  overdueInstallmentsCount: number;
  maxOverdueDays: number;
}

export interface MonthlyReport {
  month: number;
  year: number;
  newLoansDisbursed: number;
  totalPaymentsReceived: number;
  messagesSent: number;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Loan)
    private readonly loansRepository: Repository<Loan>,
    @InjectRepository(Installment)
    private readonly installmentsRepository: Repository<Installment>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(MessageLog)
    private readonly messageLogsRepository: Repository<MessageLog>,
  ) {}

  async getSummary(): Promise<DashboardSummary> {
    const [totalActiveClients, overdueInstallments, messagesSentThisWeek] =
      await Promise.all([
        this.countActiveClients(),
        this.gatherOverdueInstallments(),
        this.countMessagesSentThisWeek(),
      ]);

    return {
      totalActiveClients,
      totalOverdueInstallments: overdueInstallments.length,
      totalAmountOverdue: overdueInstallments.reduce(
        (sum, installment) => sum + installment.totalDue,
        0,
      ),
      messagesSentThisWeek,
    };
  }

  async getOverdueClients(
    query: QueryOverdueClientsDto,
  ): Promise<PaginatedResult<OverdueClientSummary>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const sortBy = query.sortBy ?? OverdueClientsSortBy.TotalOverdueAmount;

    const overdueInstallments = await this.gatherOverdueInstallments();

    const byClient = new Map<string, OverdueClientSummary>();
    for (const installment of overdueInstallments) {
      const existing = byClient.get(installment.clientId);
      if (existing) {
        existing.totalOverdueAmount += installment.totalDue;
        existing.overdueInstallmentsCount += 1;
        existing.maxOverdueDays = Math.max(
          existing.maxOverdueDays,
          installment.overdueDays,
        );
      } else {
        byClient.set(installment.clientId, {
          clientId: installment.clientId,
          firstName: installment.clientFirstName,
          lastName: installment.clientLastName,
          totalOverdueAmount: installment.totalDue,
          overdueInstallmentsCount: 1,
          maxOverdueDays: installment.overdueDays,
        });
      }
    }

    const rows = Array.from(byClient.values()).sort(
      (a, b) => b[sortBy] - a[sortBy],
    );

    const total = rows.length;
    const start = (page - 1) * limit;

    return {
      items: rows.slice(start, start + limit),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getMonthlyReport(query: MonthlyReportQueryDto): Promise<MonthlyReport> {
    const { start, end } = monthBoundaries(query.year, query.month);

    const [newLoansDisbursed, totalPaymentsReceived, messagesSent] =
      await Promise.all([
        this.loansRepository.count({
          where: { disbursedAt: Between(start, end) },
        }),
        this.sumPaymentsBetween(start, end),
        this.messageLogsRepository.count({
          where: {
            sentAt: Between(
              new Date(`${start}T00:00:00.000Z`),
              new Date(`${end}T23:59:59.999Z`),
            ),
          },
        }),
      ]);

    return {
      month: query.month,
      year: query.year,
      newLoansDisbursed,
      totalPaymentsReceived,
      messagesSent,
    };
  }

  // Every overdue-installment aggregate (summary, overdue-clients list) is
  // built from this same fetch — mirrors the grouping query in
  // OverdueReminderService and reuses enrichInstallment's formula instead
  // of reimplementing it, per docs/phases/PHASE_7_DASHBOARD.md.
  private async gatherOverdueInstallments(): Promise<
    Array<{
      clientId: string;
      clientFirstName: string;
      clientLastName: string;
      totalDue: number;
      overdueDays: number;
    }>
  > {
    const today = new Date().toISOString().slice(0, 10);

    const installments = await this.installmentsRepository.find({
      where: {
        status: InstallmentStatus.Pending,
        dueDate: LessThan(today),
        loan: { status: LoanStatus.Active },
      },
      relations: { loan: { client: true } },
    });

    return installments.map((installment) => {
      const enriched = enrichInstallment(
        installment,
        installment.loan.interestRate,
      );
      return {
        clientId: installment.loan.clientId,
        clientFirstName: installment.loan.client.firstName,
        clientLastName: installment.loan.client.lastName,
        totalDue: enriched.totalDue,
        overdueDays: enriched.overdueDays,
      };
    });
  }

  private async countActiveClients(): Promise<number> {
    const activeLoans = await this.loansRepository.find({
      where: { status: LoanStatus.Active },
      select: { clientId: true },
    });

    return new Set(activeLoans.map((loan) => loan.clientId)).size;
  }

  private async countMessagesSentThisWeek(): Promise<number> {
    const now = new Date();
    return this.messageLogsRepository.count({
      where: {
        sentAt: Between(
          startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON_MONDAY }),
          endOfWeek(now, { weekStartsOn: WEEK_STARTS_ON_MONDAY }),
        ),
      },
    });
  }

  private async sumPaymentsBetween(
    start: string,
    end: string,
  ): Promise<number> {
    const payments = await this.paymentsRepository.find({
      where: { paidAt: Between(start, end) },
      select: { amountPaid: true },
    });

    return payments.reduce((sum, payment) => sum + payment.amountPaid, 0);
  }
}
