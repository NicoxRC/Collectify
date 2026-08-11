import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';

import { ClientsService } from '../clients/clients.service';
import { PaginatedResult } from '../common/interfaces/paginatedResult.interface';
import { NewLoanReminderService } from '../whatsapp/newLoanReminder.service';

import { CreateLoanDto } from './dto/createLoan.dto';
import { UpdateLoanDto } from './dto/updateLoan.dto';
import { QueryLoansDto } from './dto/queryLoans.dto';
import { RefinanceLoanDto } from './dto/refinanceLoan.dto';
import { addMonthsToDateString, addWeeksToDateString } from './dueDateSchedule';
import { Installment, InstallmentStatus } from './entities/installment.entity';
import { InstallmentFrequency, Loan, LoanStatus } from './entities/loan.entity';
import { Payment } from './entities/payment.entity';
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

// Added for the client's standalone "Préstamos" list screen (F-16/17),
// which is a different view from Clientes and needs to show who the loan
// belongs to plus at-a-glance collection status without opening the loan.
// None of these three fields were previously computed by findAll — see the
// aggregation added there.
// Omit<Loan, 'client'>, not Loan itself: the Loan entity's `client` field is
// a required ManyToOne relation, but summarize() below intentionally strips
// the raw relation out of the response and exposes clientFullName instead —
// keeping `extends Loan` here would make TS demand a `client: Client` on
// every returned row, which is exactly what we don't want to send back.
export interface LoanSummary extends Omit<Loan, 'client'> {
  clientFullName: string;
  // Sum of totalDue (amount + accrued interest) across this loan's
  // still-pending installments — same per-installment math as
  // enrichInstallment, just aggregated across the whole loan.
  outstandingBalance: number;
  // How many of this loan's installments are already paid, for a "3/12"
  // style display alongside totalInstallments.
  installmentsPaid: number;
  // The worst (maximum) overdueDays across this loan's pending
  // installments — 0 if none are overdue. A loan-level "días de mora" has
  // no single correct definition since overdue is tracked per installment
  // (docs/DATABASE.md); "how late is the most overdue cuota" is the one
  // that matches how collections actually prioritize follow-up.
  overdueDays: number;
  // The due date of the oldest still-pending installment — whether it's
  // already overdue or not. Deliberately a single field rather than
  // separate "last overdue" / "next upcoming" dates: a loan can have both
  // overdue AND not-yet-due installments pending at once (payments aren't
  // required in order — see InstallmentsService.registerPayment), so "the
  // next one to collect" is always the oldest pending one, whichever kind
  // it is. Pair with `overdueDays` to know which case you're looking at.
  // Null when there are no pending installments left (fully paid/cancelled).
  nextInstallmentDueDate: string | null;
  // Sum of totalDue (amount + accrued interest) across ONLY the installments
  // that are actually overdue (overdueDays > 0) — unlike `outstandingBalance`,
  // which includes every still-pending installment whether overdue or not.
  // Added for ClientDetailPage's "En mora" stat card: the client caught that
  // using outstandingBalance there showed the loan's whole remaining balance
  // instead of just what's actually late, e.g. a loan with 8 pending
  // installments and only 1 overdue was showing the sum of all 8. 0 when
  // nothing's overdue.
  overdueBalance: number;
}

interface PersistLoanParams {
  clientId: string;
  promissoryNoteNumber: string;
  principalAmount: number;
  interestRate: number;
  disbursedAt: string;
  installmentFrequency: InstallmentFrequency;
  installmentAmounts: number[];
  initialInstallmentIndex?: number;
  description?: string | null;
  refinancedFromLoanId?: string | null;
}

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    @InjectRepository(Loan)
    private readonly loansRepository: Repository<Loan>,
    @InjectRepository(Installment)
    private readonly installmentsRepository: Repository<Installment>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    private readonly newLoanReminderService: NewLoanReminderService,
    private readonly clientsService: ClientsService,
  ) {}

  async create(dto: CreateLoanDto): Promise<LoanDetail> {
    await this.assertClientCanTakeNewLoan(dto.clientId, dto.principalAmount);

    const savedLoan = await this.persistLoanWithInstallments({
      clientId: dto.clientId,
      promissoryNoteNumber: dto.promissoryNoteNumber,
      principalAmount: dto.principalAmount,
      interestRate: dto.interestRate,
      disbursedAt: dto.disbursedAt,
      installmentFrequency: dto.installmentFrequency,
      installmentAmounts: dto.installmentAmounts,
      initialInstallmentIndex: dto.initialInstallmentIndex,
      description: dto.description,
    });

    await this.sendNewLoanMessageSafely(savedLoan.id);

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
      initialInstallmentIndex: dto.initialInstallmentIndex,
      description: dto.description,
      refinancedFromLoanId: id,
    });

    await this.sendNewLoanMessageSafely(newLoan.id);

    return this.findOne(newLoan.id);
  }

  // Joins `client` (for clientFullName) and, in a second query, this page's
  // installments (for outstandingBalance/installmentsPaid/overdueDays) —
  // two extra queries total, not one per loan, to back the standalone
  // "Préstamos" list (F-16/17), a different screen from Clientes that
  // needs to show whose loan it is and its collection status at a glance.
  //
  // Matches how the client already files physical pagarés — by
  // promissoryNoteNumber, ascending — instead of most-recently-created
  // first. Changed at the client's request; see
  // apps/client/docs/DESIGN_TOKENS.md "Known design/backend gaps".
  //
  // promissoryNoteNumber is a free-text column (it allows things like
  // "#743"), so a plain text sort compares it character by character, not
  // as a number — "101" sorts before "2" because '1' < '2' as characters.
  // Sorted by its numeric part instead (missing/non-numeric values last,
  // then a text sort as a stable tiebreaker) — done in application code
  // (fetch every match unpaginated, sort, then slice the page) rather than
  // a computed DB expression, same tradeoff as ClientsService.findAll's
  // name sort and fine at this business's scale.
  async findAll(query: QueryLoansDto): Promise<PaginatedResult<LoanSummary>> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;

    const matches = await this.loansRepository.find({
      where: this.buildFindAllWhere(query),
      relations: { client: true },
    });
    // TypeORM silently drops soft-deleted relations, so a loan whose client
    // was removed comes back with `client: null` despite the non-null type —
    // hide those rather than crash summarize() on a null client.
    const visible = matches.filter((loan) => loan.client !== null);
    const sorted = visible.sort(compareLoansByPromissoryNoteNumber);

    const total = sorted.length;
    const start = (page - 1) * limit;
    const loans = sorted.slice(start, start + limit);
    const items = await this.summarize(loans);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private buildFindAllWhere(
    query: QueryLoansDto,
  ): FindOptionsWhere<Loan> | FindOptionsWhere<Loan>[] {
    const base: FindOptionsWhere<Loan> = {};
    if (query.clientId) {
      base.clientId = query.clientId;
    }
    if (query.status) {
      base.status = query.status;
    }

    if (!query.search) {
      return base;
    }

    const search = ILike(`%${query.search}%`);
    return [
      { ...base, client: { firstName: search } },
      { ...base, client: { lastName: search } },
      { ...base, promissoryNoteNumber: search },
    ];
  }

  private async summarize(loans: Loan[]): Promise<LoanSummary[]> {
    const loanIds = loans.map((loan) => loan.id);
    const installments = loanIds.length
      ? await this.installmentsRepository.find({
          where: { loanId: In(loanIds) },
        })
      : [];

    return loans.map((loan) => {
      const { client, ...loanFields } = loan;
      const enriched = installments
        .filter((installment) => installment.loanId === loan.id)
        .map((installment) =>
          enrichInstallment(installment, loan.interestRate),
        );

      return {
        ...loanFields,
        clientFullName: `${client.firstName} ${client.lastName}`,
        outstandingBalance: enriched
          .filter(
            (installment) => installment.status === InstallmentStatus.Pending,
          )
          .reduce((sum, installment) => sum + installment.totalDue, 0),
        installmentsPaid: enriched.filter(
          (installment) => installment.status === InstallmentStatus.Paid,
        ).length,
        overdueDays: enriched.reduce(
          (max, installment) => Math.max(max, installment.overdueDays),
          0,
        ),
        nextInstallmentDueDate: enriched
          .filter(
            (installment) => installment.status === InstallmentStatus.Pending,
          )
          .reduce<string | null>(
            (earliest, installment) =>
              !earliest || installment.dueDate < earliest
                ? installment.dueDate
                : earliest,
            null,
          ),
        overdueBalance: enriched
          .filter(
            (installment) =>
              installment.status === InstallmentStatus.Pending &&
              installment.overdueDays > 0,
          )
          .reduce((sum, installment) => sum + installment.totalDue, 0),
      };
    });
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

  // Added for F-22 "Cambiar estado" — but only the "Pagado" transition maps
  // to anything real on the backend. "Al día" and "En mora" are NOT stored
  // states (docs/DATABASE.md: overdue is derived per-installment from due
  // dates, never a loan-level flag someone sets), so there's nothing for
  // those two to actually change — they're already always correct,
  // automatically. This is for the manual case Figma doesn't distinguish
  // from the others: the client paid in cash/outside the system, and an
  // admin needs to close the loan out without a payment trail through
  // every remaining cuota. Marks every still-pending installment Paid too,
  // so the loan doesn't show "Pagado" while its installments still read as
  // pending/overdue — but no Payment rows are created, since there's no
  // real amount/date to record per installment for this kind of override.
  async markAsPaid(id: string): Promise<LoanDetail> {
    const loan = await this.findLoanOrThrow(id);
    if (loan.status !== LoanStatus.Active) {
      throw new BadRequestException(
        `Loan ${id} cannot be marked as paid because its status is '${loan.status}' — only active loans can be marked paid this way`,
      );
    }

    await this.loansRepository.update({ id }, { status: LoanStatus.Paid });
    await this.installmentsRepository.update(
      { loanId: id, status: InstallmentStatus.Pending },
      { status: InstallmentStatus.Paid },
    );

    return this.findOne(id);
  }

  // Added for the loan detail screen's "Historial de pagos" (F-19) — there
  // was previously no way to list a loan's payments at all, only register
  // one (POST /installments/:id/payments). Payments are stored per
  // installment (docs/DATABASE.md), so this joins across every installment
  // that belongs to this loan. Ordered oldest-first, matching the Figma
  // numbered list (#1, #2, #3...).
  async getPayments(loanId: string): Promise<Payment[]> {
    await this.findLoanOrThrow(loanId);

    const installments = await this.installmentsRepository.find({
      where: { loanId },
      select: ['id'],
    });
    const installmentIds = installments.map((installment) => installment.id);
    if (installmentIds.length === 0) {
      return [];
    }

    return this.paymentsRepository.find({
      where: { installmentId: In(installmentIds) },
      order: { paidAt: 'ASC' },
    });
  }

  // Phase 10 cupo/mora-block guard — only on create(), not refinance(): the
  // phase brief scopes this to new-loan creation specifically (refinancing
  // restructures existing exposure rather than adding new exposure, and
  // isn't mentioned in docs/phases/PHASE_10_CLIENT_CAPACITY.md's guard
  // scope). Two distinct rejection reasons, checked and reported
  // separately, per that doc: mora-block first, since it applies regardless
  // of how much cupo is left.
  private async assertClientCanTakeNewLoan(
    clientId: string,
    principalAmount: number,
  ): Promise<void> {
    const isMoraBlocked = await this.clientsService.hasMoraBlock(clientId);
    if (isMoraBlocked) {
      throw new BadRequestException(
        'This client has at least one installment more than 30 days ' +
          'overdue and cannot be given a new loan until it is resolved.',
      );
    }

    const { creditAvailable } =
      await this.clientsService.getCreditUsage(clientId);
    if (creditAvailable !== null && principalAmount > creditAvailable) {
      throw new BadRequestException(
        `This loan's principal (${principalAmount}) exceeds the client's ` +
          `available cupo (${creditAvailable}).`,
      );
    }
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
    this.assertInitialInstallmentIndexInRange(
      params.initialInstallmentIndex,
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
      description: params.description ?? null,
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
        isInitial: index === params.initialInstallmentIndex,
      }),
    );
    await this.installmentsRepository.save(installments);

    return savedLoan;
  }

  // A failed/skipped "new loan" WhatsApp message must never fail the loan
  // creation itself — same principle as the rest of the whatsapp module
  // (messaging failures are a business outcome, logged, not an application
  // error). See docs/phases/PHASE_9_MESSAGE_TYPES.md.
  private async sendNewLoanMessageSafely(loanId: string): Promise<void> {
    try {
      await this.newLoanReminderService.sendNewLoanMessage(loanId);
    } catch (error) {
      this.logger.error(
        `Failed to send new-loan WhatsApp message for loan ${loanId}`,
        error,
      );
    }
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

  private assertInitialInstallmentIndexInRange(
    initialInstallmentIndex: number | undefined,
    installmentAmounts: number[],
  ): void {
    if (
      initialInstallmentIndex !== undefined &&
      initialInstallmentIndex >= installmentAmounts.length
    ) {
      throw new BadRequestException(
        `initialInstallmentIndex (${initialInstallmentIndex}) is out of range — installmentAmounts has ${installmentAmounts.length} entries`,
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

// Mirrors NULLIF(regexp_replace(promissory_note_number, '\D', '', 'g'),
// '')::bigint from the previous SQL-level sort: strip everything but
// digits, null when nothing's left. BigInt (not parseInt) to match
// Postgres's bigint precision for unusually long numbers.
function extractNumericPart(promissoryNoteNumber: string): bigint | null {
  const digits = promissoryNoteNumber.replace(/\D/g, '');
  return digits === '' ? null : BigInt(digits);
}

// NULLS LAST for the numeric part, then a plain text compare as the
// tiebreaker — same two-level ORDER BY as the previous query builder.
function compareLoansByPromissoryNoteNumber(a: Loan, b: Loan): number {
  const numericA = extractNumericPart(a.promissoryNoteNumber);
  const numericB = extractNumericPart(b.promissoryNoteNumber);

  if (numericA === null && numericB !== null) {
    return 1;
  }
  if (numericA !== null && numericB === null) {
    return -1;
  }
  if (numericA !== null && numericB !== null && numericA !== numericB) {
    return numericA < numericB ? -1 : 1;
  }

  if (a.promissoryNoteNumber < b.promissoryNoteNumber) {
    return -1;
  }
  if (a.promissoryNoteNumber > b.promissoryNoteNumber) {
    return 1;
  }
  return 0;
}
