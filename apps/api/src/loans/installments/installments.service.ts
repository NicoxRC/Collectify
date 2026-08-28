import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  And,
  DataSource,
  EntityManager,
  Equal,
  FindOptionsWhere,
  In,
  LessThan,
  Repository,
} from 'typeorm';

import { PaginatedResult } from '../../common/interfaces/paginatedResult.interface';
import { Installment, InstallmentStatus } from '../entities/installment.entity';
import { Loan, LoanStatus } from '../entities/loan.entity';
import { LoanInstallmentConcept } from '../entities/loanInstallmentConcept.entity';
import { Payment } from '../entities/payment.entity';
import { PaymentImage } from '../entities/paymentImage.entity';

import { CreatePaymentDto } from './dto/createPayment.dto';
import { QueryInstallmentsDto } from './dto/queryInstallments.dto';
import { BulkPaymentEntryDto } from './dto/registerBulkPayments.dto';
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
    @InjectRepository(LoanInstallmentConcept)
    private readonly loanInstallmentConceptsRepository: Repository<LoanInstallmentConcept>,
    @InjectRepository(PaymentImage)
    private readonly paymentImagesRepository: Repository<PaymentImage>,
    private readonly dataSource: DataSource,
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
    const conceptsByInstallmentId = await this.findConceptsByInstallmentId(
      items.map((installment) => installment.id),
    );

    return {
      items: items.map((installment) =>
        enrichInstallment(
          installment,
          installment.loan.interestRate,
          conceptsByInstallmentId.get(installment.id) ?? [],
        ),
      ),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Groups a page of installments' LoanInstallmentConcept rows by
  // installmentId in one query — see LoansService's identical helper for
  // GET /loans/:id (docs/phases/PHASE_14_INTEREST_CONCEPTS.md).
  private async findConceptsByInstallmentId(
    installmentIds: string[],
  ): Promise<Map<string, LoanInstallmentConcept[]>> {
    const map = new Map<string, LoanInstallmentConcept[]>();
    if (installmentIds.length === 0) {
      return map;
    }

    const concepts = await this.loanInstallmentConceptsRepository.find({
      where: { installmentId: In(installmentIds) },
    });
    for (const concept of concepts) {
      const existing = map.get(concept.installmentId) ?? [];
      existing.push(concept);
      map.set(concept.installmentId, existing);
    }
    return map;
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
      // imageUrl is deprecated as of Phase 28 — no longer written for new
      // payments, see payment.entity.ts. Photos go through payment_images
      // below instead.
      imageUrl: null,
    });
    const savedPayment = await this.paymentsRepository.save(payment);
    await this.savePaymentImages(
      savedPayment.id,
      dto.imageUrls,
      this.paymentImagesRepository,
    );

    if (installment.status === InstallmentStatus.Pending) {
      const totalPaid = await this.sumPayments(
        installmentId,
        this.paymentsRepository,
      );
      if (totalPaid >= installment.amount) {
        await this.installmentsRepository.update(
          { id: installmentId },
          { status: InstallmentStatus.Paid },
        );
        await this.cascadeLoanStatusIfFullyPaid(
          installment.loanId,
          this.installmentsRepository,
          this.loansRepository,
        );
      }
    }

    return savedPayment;
  }

  // Phase 28 — pays several installments in one action, one amount entered
  // individually per installment (confirmed with the human, not a single
  // total split across them). Requires FULL payment of every installment in
  // the batch — a batch entry that wouldn't fully settle its installment
  // rejects the whole request before anything is persisted, per the same
  // confirmed rule; partial payment stays on the single-installment flow
  // above, which already supports it. All-or-nothing: wrapped in one
  // transaction, same precedent as LoansService.refinance() — a failure on
  // any entry rolls back every row already created earlier in this request.
  async registerBulkPayments(
    entries: BulkPaymentEntryDto[],
  ): Promise<Payment[]> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const installmentsRepository = manager.getRepository(Installment);
      const paymentsRepository = manager.getRepository(Payment);
      const loansRepository = manager.getRepository(Loan);
      const paymentImagesRepository = manager.getRepository(PaymentImage);

      const savedPayments: Payment[] = [];
      const loanIdsToCascade = new Set<string>();

      for (const entry of entries) {
        const installment = await installmentsRepository.findOneBy({
          id: entry.installmentId,
        });
        if (!installment) {
          throw new NotFoundException(
            `Installment with id ${entry.installmentId} not found`,
          );
        }
        if (installment.status !== InstallmentStatus.Pending) {
          throw new BadRequestException(
            `Installment ${installment.installmentNumber} (id ${installment.id}) is not pending — it cannot be paid again.`,
          );
        }

        const totalPaidBefore = await this.sumPayments(
          entry.installmentId,
          paymentsRepository,
        );
        const totalPaidAfter = totalPaidBefore + entry.amountPaid;
        if (totalPaidAfter < installment.amount) {
          throw new BadRequestException(
            `The amount for installment ${installment.installmentNumber} (id ${installment.id}) does not cover its remaining balance — a bulk payment must fully settle every selected installment. Use the single-installment flow for a partial payment.`,
          );
        }

        const payment = paymentsRepository.create({
          installmentId: entry.installmentId,
          amountPaid: entry.amountPaid,
          paidAt: entry.paidAt,
          observation: entry.observation ?? null,
          imageUrl: null,
        });
        const savedPayment = await paymentsRepository.save(payment);
        await this.savePaymentImages(
          savedPayment.id,
          entry.imageUrls,
          paymentImagesRepository,
        );
        savedPayments.push(savedPayment);

        await installmentsRepository.update(
          { id: entry.installmentId },
          { status: InstallmentStatus.Paid },
        );
        loanIdsToCascade.add(installment.loanId);
      }

      for (const loanId of loanIdsToCascade) {
        await this.cascadeLoanStatusIfFullyPaid(
          loanId,
          installmentsRepository,
          loansRepository,
        );
      }

      return savedPayments;
    });
  }

  private async savePaymentImages(
    paymentId: string,
    imageUrls: string[] | undefined,
    paymentImagesRepository: Repository<PaymentImage>,
  ): Promise<void> {
    if (!imageUrls || imageUrls.length === 0) {
      return;
    }
    const images = imageUrls.map((imageUrl) =>
      paymentImagesRepository.create({ paymentId, imageUrl }),
    );
    await paymentImagesRepository.save(images);
  }

  private async sumPayments(
    installmentId: string,
    paymentsRepository: Repository<Payment>,
  ): Promise<number> {
    const payments = await paymentsRepository.find({
      where: { installmentId },
      select: { amountPaid: true },
    });

    return payments.reduce((sum, payment) => sum + payment.amountPaid, 0);
  }

  private async cascadeLoanStatusIfFullyPaid(
    loanId: string,
    installmentsRepository: Repository<Installment>,
    loansRepository: Repository<Loan>,
  ): Promise<void> {
    const installments = await installmentsRepository.find({
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

    await loansRepository.update(
      { id: loanId, status: LoanStatus.Active },
      { status: LoanStatus.Paid },
    );
  }
}
