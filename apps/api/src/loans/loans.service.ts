import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  ILike,
  In,
  Repository,
} from 'typeorm';

import { ClientsService } from '../clients/clients.service';
import { PaginatedResult } from '../common/interfaces/paginatedResult.interface';
import { InterestConceptTypesService } from '../interestConceptTypes/interestConceptTypes.service';
import { calculateMaxEffectiveInstallmentRate } from '../usuryRates/calculateLoanEffectiveRate';
import { UsuryRateService } from '../usuryRates/usuryRates.service';
import { MessageLogStatus } from '../whatsapp/entities/messageLog.entity';
import { NewLoanReminderService } from '../whatsapp/newLoanReminder.service';

import { DocumentType } from '../clients/entities/client.entity';
import {
  ConceptAssignment,
  GeneratedInstallment,
  generateAmortizationSchedule,
} from './amortization/generateSchedule';
import { CreateLoanDto } from './dto/createLoan.dto';
import { LoanConceptAssignmentDto } from './dto/loanConceptAssignment.dto';
import { UpdateLoanDto } from './dto/updateLoan.dto';
import { PreviewScheduleDto } from './dto/previewSchedule.dto';
import { QueryLoansDto } from './dto/queryLoans.dto';
import { RefinanceLoanDto } from './dto/refinanceLoan.dto';
import { addMonthsToDateString, addWeeksToDateString } from './dueDateSchedule';
import { Installment, InstallmentStatus } from './entities/installment.entity';
import { InstallmentFrequency, Loan, LoanStatus } from './entities/loan.entity';
import { LoanInstallmentConcept } from './entities/loanInstallmentConcept.entity';
import { Payment } from './entities/payment.entity';
import {
  enrichInstallment,
  InstallmentWithCalculated,
} from './installments/enrichInstallment';
import { calculateOverdueDays } from './installments/installmentCalculations';
import {
  calculatePayoff,
  PayoffInstallmentInput,
  PayoffQuote,
} from './payoff/calculatePayoff';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const POSTGRES_UNIQUE_VIOLATION = '23505';

export interface PreviewedInstallment {
  installmentNumber: number;
  dueDate: string;
  principalPortion: number;
  amount: number;
  conceptBreakdown: { name: string; amount: number }[];
}

// Present only when the loan's highest per-installment effective rate
// exceeds the usury ceiling on file — this is a warning the admin can
// proceed past (with an optional usuryJustification note), not a block.
// See docs/phases/PHASE_15_USURY_RATE.md "Resolved".
export interface UsuryWarning {
  maxEffectiveInstallmentRate: number;
  currentCeilingRate: number;
}

export interface SchedulePreview {
  installments: PreviewedInstallment[];
  usuryWarning: UsuryWarning | null;
}

// See docs/phases/PHASE_17_REFINANCING_RECALC.md "Resolved" — advisory
// data for pre-filling RefinanceLoanForm.tsx, not a new persisted concept.
export interface RefinanceQuote {
  payoff: PayoffQuote;
  suggestedPrincipalAmount: number;
  concepts: LoanConceptAssignmentDto[];
  // Installment numbers that must be paid in full before this loan can
  // actually be refinanced — confirmed with the human (2026-08-18): the
  // client must be current first. Empty when nothing blocks refinancing.
  // See LoansService.blockingInstallmentNumbers.
  blockedByPendingInstallments: number[];
}

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
  totalInstallments: number;
  concepts: LoanConceptAssignmentDto[];
  // Purely informational — the down payment the client already made
  // outside the credit system to cover the part of the purchase this
  // loan doesn't finance. It is not one of the loan's installments, has
  // no due date, accrues no interest, and never affects the amortization
  // schedule. See docs/phases/PHASE_13_INITIAL_INSTALLMENT.md (corrected
  // after client QA — this was originally modeled as flagging one of the
  // generated installments, which was wrong).
  initialPayment?: number | null;
  description?: string | null;
  usuryJustification?: string | null;
  refinancedFromLoanId?: string | null;
  coDebtorFullName?: string | null;
  coDebtorDocumentType?: DocumentType | null;
  coDebtorDocumentNumber?: string | null;
  coDebtorPhoneNumber?: string | null;
  coDebtorAddress?: string | null;
  coDebtorRelationship?: string | null;
  coDebtorIdDocumentUrl?: string | null;
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
    @InjectRepository(LoanInstallmentConcept)
    private readonly loanInstallmentConceptsRepository: Repository<LoanInstallmentConcept>,
    private readonly interestConceptTypesService: InterestConceptTypesService,
    private readonly usuryRateService: UsuryRateService,
    private readonly newLoanReminderService: NewLoanReminderService,
    private readonly clientsService: ClientsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateLoanDto): Promise<LoanDetail> {
    await this.assertClientCanTakeNewLoan(dto.clientId, dto.principalAmount);

    // Transactional — persistLoanWithInstallments is three sequential
    // saves (loan, then installments, then concept rows); without this, a
    // failure partway (e.g. a concept type deleted mid-request) would
    // leave an orphaned loan with no installments. See the same fix in
    // refinance(), which found this the hard way.
    const savedLoan = await this.dataSource.transaction((manager) =>
      this.persistLoanWithInstallments(
        {
          clientId: dto.clientId,
          promissoryNoteNumber: dto.promissoryNoteNumber,
          principalAmount: dto.principalAmount,
          interestRate: dto.interestRate,
          disbursedAt: dto.disbursedAt,
          installmentFrequency: dto.installmentFrequency,
          totalInstallments: dto.totalInstallments,
          concepts: dto.concepts,
          initialPayment: dto.initialPayment,
          description: dto.description,
          usuryJustification: dto.usuryJustification,
          coDebtorFullName: dto.coDebtorFullName,
          coDebtorDocumentType: dto.coDebtorDocumentType,
          coDebtorDocumentNumber: dto.coDebtorDocumentNumber,
          coDebtorPhoneNumber: dto.coDebtorPhoneNumber,
          coDebtorAddress: dto.coDebtorAddress,
          coDebtorRelationship: dto.coDebtorRelationship,
          coDebtorIdDocumentUrl: dto.coDebtorIdDocumentUrl,
        },
        manager,
      ),
    );

    await this.sendNewLoanMessageSafely(savedLoan.id);

    return this.findOne(savedLoan.id);
  }

  // Runs the same schedule generation as create()/refinance() without
  // persisting anything — lets the client show the admin what a loan's
  // installments will look like before they commit. See
  // docs/phasesClient/PHASE_14_INTEREST_CONCEPTS.md.
  async previewSchedule(dto: PreviewScheduleDto): Promise<SchedulePreview> {
    const concepts = await this.resolveConcepts(dto.concepts);
    const schedule = generateAmortizationSchedule(
      dto.principalAmount,
      dto.totalInstallments,
      concepts,
    );

    const installments = schedule.map((generated) => ({
      installmentNumber: generated.installmentNumber,
      dueDate: this.calculateDueDate(
        dto.disbursedAt,
        dto.installmentFrequency,
        generated.installmentNumber,
      ),
      principalPortion: generated.principalPortion,
      amount: generated.amount,
      conceptBreakdown: generated.concepts.map((concept) => ({
        name: concept.name,
        amount: concept.computedAmount,
      })),
    }));

    const usuryWarning = await this.buildUsuryWarning(
      schedule,
      dto.principalAmount,
    );

    return { installments, usuryWarning };
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

    const blockingInstallmentNumbers =
      await this.findBlockingInstallmentNumbers(id);
    if (blockingInstallmentNumbers.length > 0) {
      throw new BadRequestException(
        `This loan cannot be refinanced until installment(s) ${blockingInstallmentNumbers.join(', ')} are paid in full — the client must be current before refinancing. See docs/phases/PHASE_17_REFINANCING_RECALC.md.`,
      );
    }

    // Transactional — closing out the old loan, cancelling its pending
    // installments, and creating the new one must all succeed or all roll
    // back. Previously these were three separate non-transactional steps:
    // if persistLoanWithInstallments failed partway (e.g. a duplicate
    // promissory note number), the old loan was left stuck as
    // 'refinanced' with its installments cancelled and no replacement
    // loan — a real incident found during manual QA (2026-08-18).
    const newLoan = await this.dataSource.transaction(async (manager) => {
      oldLoan.status = LoanStatus.Refinanced;
      await manager.getRepository(Loan).save(oldLoan);

      await manager
        .getRepository(Installment)
        .update(
          { loanId: id, status: InstallmentStatus.Pending },
          { status: InstallmentStatus.Cancelled },
        );

      return this.persistLoanWithInstallments(
        {
          clientId: oldLoan.clientId,
          promissoryNoteNumber: dto.promissoryNoteNumber,
          principalAmount: dto.principalAmount,
          interestRate: dto.interestRate,
          disbursedAt: dto.disbursedAt,
          installmentFrequency: dto.installmentFrequency,
          totalInstallments: dto.totalInstallments,
          concepts: dto.concepts,
          initialPayment: dto.initialPayment,
          description: dto.description,
          usuryJustification: dto.usuryJustification,
          refinancedFromLoanId: id,
          // Carries over the old loan's co-debtor unchanged unless the dto
          // explicitly overrides a field — confirmed default behavior, see
          // RefinanceLoanDto and docs/phases/PHASE_21_CLIENT_PROFILE.md.
          coDebtorFullName: dto.coDebtorFullName ?? oldLoan.coDebtorFullName,
          coDebtorDocumentType:
            dto.coDebtorDocumentType ?? oldLoan.coDebtorDocumentType,
          coDebtorDocumentNumber:
            dto.coDebtorDocumentNumber ?? oldLoan.coDebtorDocumentNumber,
          coDebtorPhoneNumber:
            dto.coDebtorPhoneNumber ?? oldLoan.coDebtorPhoneNumber,
          coDebtorAddress: dto.coDebtorAddress ?? oldLoan.coDebtorAddress,
          coDebtorRelationship:
            dto.coDebtorRelationship ?? oldLoan.coDebtorRelationship,
          coDebtorIdDocumentUrl:
            dto.coDebtorIdDocumentUrl ?? oldLoan.coDebtorIdDocumentUrl,
        },
        manager,
      );
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
    const conceptsByInstallmentId = await this.findConceptsByInstallmentId(
      installments.map((installment) => installment.id),
    );

    const refinancedTo = await this.loansRepository.findOne({
      where: { refinancedFromLoanId: id },
    });

    return {
      ...loan,
      installments: installments.map((installment) =>
        enrichInstallment(
          installment,
          loan.interestRate,
          conceptsByInstallmentId.get(installment.id) ?? [],
        ),
      ),
      refinancedToLoanId: refinancedTo?.id ?? null,
    };
  }

  // Groups a batch of installments' LoanInstallmentConcept rows by
  // installmentId in one query, for GET /loans/:id's per-installment
  // conceptBreakdown (docs/phases/PHASE_14_INTEREST_CONCEPTS.md).
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

  // How much it costs to close this loan out today, per
  // docs/phases/PHASE_16_EARLY_PAYOFF.md — never blindly sums remaining
  // installment totals; a not-yet-due installment contributes only
  // principal, at face value, with zero interest (Colombian Civil Code
  // Art. 1653, confirmed with the human). Read-only, safe to call on any
  // loan regardless of status (an already-paid/refinanced loan simply has
  // no pending installments, so the quote comes back empty).
  async getPayoffQuote(id: string): Promise<PayoffQuote> {
    const loan = await this.findLoanOrThrow(id);
    const pending = await this.findPendingInstallments(id);
    return calculatePayoff(
      pending.map(toPayoffInstallmentInput),
      loan.interestRate,
    );
  }

  // Separate, explicit flow from registerPayment (confirmed with the
  // human — see the phase doc's "Resolved" point 5): always settles the
  // loan for its FULL quoted amount, closing it out entirely. Registers
  // one real Payment row per still-pending installment (unlike
  // markAsPaid(), which records no payment trail at all) so the payoff
  // leaves the same kind of historical record an ordinary payment would.
  async payoff(id: string): Promise<LoanDetail> {
    const loan = await this.findLoanOrThrow(id);
    if (loan.status !== LoanStatus.Active) {
      throw new BadRequestException(
        `Loan ${id} cannot be paid off because its status is '${loan.status}' — only active loans can be paid off this way`,
      );
    }

    const pending = await this.findPendingInstallments(id);
    const quote = calculatePayoff(
      pending.map(toPayoffInstallmentInput),
      loan.interestRate,
    );

    const paidAt = new Date().toISOString().slice(0, 10);
    const payments = quote.installments.map((breakdown) =>
      this.paymentsRepository.create({
        installmentId: breakdown.installmentId,
        amountPaid: breakdown.totalDue,
        paidAt,
        observation: 'Liquidación anticipada',
        imageUrl: null,
      }),
    );
    if (payments.length > 0) {
      await this.paymentsRepository.save(payments);
    }

    await this.installmentsRepository.update(
      { loanId: id, status: InstallmentStatus.Pending },
      { status: InstallmentStatus.Paid },
    );
    await this.loansRepository.update({ id }, { status: LoanStatus.Paid });

    return this.findOne(id);
  }

  private findPendingInstallments(loanId: string): Promise<Installment[]> {
    return this.installmentsRepository.find({
      where: { loanId, status: InstallmentStatus.Pending },
      order: { installmentNumber: 'ASC' },
    });
  }

  // Suggests what to pre-fill when refinancing — per
  // docs/phases/PHASE_17_REFINANCING_RECALC.md "Resolved", this reopens
  // Phase 6's manual-entry decision but keeps the field editable, so this
  // is advisory only: refinance() itself still accepts whatever
  // principalAmount/concepts the admin actually submits, unchanged.
  // suggestedPrincipalAmount reuses Phase 16's calculatePayoff() directly
  // (the exact same figure a payoff quote for this loan would show) rather
  // than a separate formula, so the two can never silently disagree on
  // "what the client currently owes." Concepts are carried over from the
  // loan's first installment — the representative baseline, since
  // per-installment overrides are an expected-to-be-rare case with no
  // well-defined mapping onto a new loan's possibly-different installment
  // count — excluding any whose catalog type was since deleted (no valid
  // id left to resubmit).
  async getRefinanceQuote(id: string): Promise<RefinanceQuote> {
    const loan = await this.findLoanOrThrow(id);
    const pending = await this.findPendingInstallments(id);
    const payoff = calculatePayoff(
      pending.map(toPayoffInstallmentInput),
      loan.interestRate,
    );
    const blockedByPendingInstallments =
      this.blockingInstallmentNumbers(pending);

    const firstInstallment = await this.installmentsRepository.findOne({
      where: { loanId: id },
      order: { installmentNumber: 'ASC' },
    });
    const concepts = firstInstallment
      ? await this.loanInstallmentConceptsRepository.find({
          where: { installmentId: firstInstallment.id },
        })
      : [];

    return {
      payoff,
      suggestedPrincipalAmount: payoff.totalDue,
      concepts: concepts
        .filter((concept) => concept.interestConceptTypeId !== null)
        .map((concept) => ({
          conceptTypeId: concept.interestConceptTypeId as string,
          calculationType: concept.calculationType,
          value: concept.value,
        })),
      blockedByPendingInstallments,
    };
  }

  // Confirmed with the human (2026-08-18): refinancing requires the client
  // to be current on the old loan — every overdue installment must be paid
  // off as an ordinary payment first. Additionally, once the most overdue
  // installment has reached 8 days past due, the NEXT installment (even
  // though its own due date hasn't arrived yet) must also be settled first
  // — the client can't use a refinance to "skip ahead" past the
  // still-current installment once they're 8+ days behind on the one
  // before it. Returns an empty array when nothing blocks refinancing.
  private blockingInstallmentNumbers(pending: Installment[]): number[] {
    const today = new Date();
    const overdue = pending.filter(
      (installment) =>
        calculateOverdueDays(new Date(installment.dueDate), today) > 0,
    );
    if (overdue.length === 0) {
      return [];
    }

    const blocking = overdue.map(
      (installment) => installment.installmentNumber,
    );
    const mostOverdue = overdue[overdue.length - 1];
    const mostOverdueDays = calculateOverdueDays(
      new Date(mostOverdue.dueDate),
      today,
    );
    if (mostOverdueDays >= 8) {
      const next = pending.find(
        (installment) =>
          installment.installmentNumber === mostOverdue.installmentNumber + 1,
      );
      if (next) {
        blocking.push(next.installmentNumber);
      }
    }

    return blocking;
  }

  private async findBlockingInstallmentNumbers(
    loanId: string,
  ): Promise<number[]> {
    const pending = await this.findPendingInstallments(loanId);
    return this.blockingInstallmentNumbers(pending);
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

  // Warning only, never throws (confirmed with the human — see
  // docs/phases/PHASE_15_USURY_RATE.md "Resolved"). Returns null when the
  // loan's highest per-installment effective rate is within the current
  // ceiling, or when no ceiling has ever been entered (nothing to compare
  // against yet).
  private async buildUsuryWarning(
    schedule: GeneratedInstallment[],
    principalAmount: number,
  ): Promise<UsuryWarning | null> {
    const currentRate = await this.usuryRateService.getCurrentRate();
    if (currentRate === null) return null;

    const maxEffectiveInstallmentRate = calculateMaxEffectiveInstallmentRate(
      schedule,
      principalAmount,
    );
    if (maxEffectiveInstallmentRate <= currentRate.ratePercentage) return null;

    return {
      maxEffectiveInstallmentRate,
      currentCeilingRate: currentRate.ratePercentage,
    };
  }

  // Shared by create() and refinance() — both need a loan row plus its
  // generated installments (and each installment's concept breakdown),
  // differing only in whether refinancedFromLoanId is set. As of Phase 14
  // the schedule is generated, not hand-entered — see
  // docs/phases/PHASE_14_INTEREST_CONCEPTS.md.
  private async persistLoanWithInstallments(
    params: PersistLoanParams,
    manager: EntityManager,
  ): Promise<Loan> {
    const loansRepository = manager.getRepository(Loan);
    const installmentsRepository = manager.getRepository(Installment);
    const loanInstallmentConceptsRepository = manager.getRepository(
      LoanInstallmentConcept,
    );

    await this.assertPromissoryNoteNumberIsUnique(
      params.promissoryNoteNumber,
      loansRepository,
    );

    const concepts = await this.resolveConcepts(params.concepts);
    const schedule = generateAmortizationSchedule(
      params.principalAmount,
      params.totalInstallments,
      concepts,
    );

    // Creation-time only, not recomputed on read (confirmed with the
    // human) — a warning, never a block. See
    // docs/phases/PHASE_15_USURY_RATE.md "Resolved".
    const usuryWarning = await this.buildUsuryWarning(
      schedule,
      params.principalAmount,
    );

    const loan = loansRepository.create({
      clientId: params.clientId,
      promissoryNoteNumber: params.promissoryNoteNumber,
      principalAmount: params.principalAmount,
      interestRate: params.interestRate,
      disbursedAt: params.disbursedAt,
      installmentFrequency: params.installmentFrequency,
      totalInstallments: params.totalInstallments,
      status: LoanStatus.Active,
      description: params.description ?? null,
      initialPayment: params.initialPayment ?? null,
      usuryCeilingExceededAtCreation: usuryWarning !== null,
      usuryJustification: params.usuryJustification ?? null,
      refinancedFromLoanId: params.refinancedFromLoanId ?? null,
      coDebtorFullName: params.coDebtorFullName ?? null,
      coDebtorDocumentType: params.coDebtorDocumentType ?? null,
      coDebtorDocumentNumber: params.coDebtorDocumentNumber ?? null,
      coDebtorPhoneNumber: params.coDebtorPhoneNumber ?? null,
      coDebtorAddress: params.coDebtorAddress ?? null,
      coDebtorRelationship: params.coDebtorRelationship ?? null,
      coDebtorIdDocumentUrl: params.coDebtorIdDocumentUrl ?? null,
    });

    let savedLoan: Loan;
    try {
      savedLoan = await loansRepository.save(loan);
    } catch (error) {
      throw this.mapUniqueViolation(error);
    }

    const installments = schedule.map((generated) =>
      installmentsRepository.create({
        loanId: savedLoan.id,
        installmentNumber: generated.installmentNumber,
        amount: generated.amount,
        principalPortion: generated.principalPortion,
        dueDate: this.calculateDueDate(
          params.disbursedAt,
          params.installmentFrequency,
          generated.installmentNumber,
        ),
        status: InstallmentStatus.Pending,
      }),
    );
    const savedInstallments = await installmentsRepository.save(installments);

    const conceptRows = savedInstallments.flatMap((installment, index) =>
      schedule[index].concepts.map((concept) =>
        loanInstallmentConceptsRepository.create({
          installmentId: installment.id,
          interestConceptTypeId: concept.conceptTypeId,
          nameSnapshot: concept.name,
          calculationType: concept.calculationType,
          value: concept.value,
          computedAmount: concept.computedAmount,
        }),
      ),
    );
    if (conceptRows.length > 0) {
      await loanInstallmentConceptsRepository.save(conceptRows);
    }

    return savedLoan;
  }

  // Resolves each referenced concept type's current name from the catalog
  // (snapshotted onto LoanInstallmentConcept — an edit to the catalog entry
  // later must never change an already-generated schedule, confirmed with
  // the human). Concepts are the same for every installment of a loan —
  // set once at creation, not overridable per installment — since that's
  // what makes the level-payment (cuota fija) schedule well-defined; see
  // docs/phases/PHASE_14_INTEREST_CONCEPTS.md.
  private async resolveConcepts(
    concepts: LoanConceptAssignmentDto[],
  ): Promise<ConceptAssignment[]> {
    const distinctConceptTypeIds = new Set(
      concepts.map((concept) => concept.conceptTypeId),
    );

    const nameByConceptTypeId = new Map<string, string>();
    for (const conceptTypeId of distinctConceptTypeIds) {
      const conceptType =
        await this.interestConceptTypesService.findOneOrThrow(conceptTypeId);
      nameByConceptTypeId.set(conceptTypeId, conceptType.name);
    }

    return concepts.map((concept) => ({
      conceptTypeId: concept.conceptTypeId,
      name: nameByConceptTypeId.get(concept.conceptTypeId) ?? '',
      calculationType: concept.calculationType,
      value: concept.value,
    }));
  }

  // A failed/skipped "new loan" WhatsApp message must never fail the loan
  // creation itself — same principle as the rest of the whatsapp module
  // (messaging failures are a business outcome, logged, not an application
  // error). See docs/phases/PHASE_9_MESSAGE_TYPES.md.
  //
  // Only a genuinely Sent result marks newLoanMessageSentAt — a Failed
  // result (WhatsAppService itself reported failure, no exception thrown)
  // must leave it null, so the Phase 18 retry cron picks the loan back up.
  // See docs/phases/PHASE_18_MESSAGE_AUDIENCES.md.
  private async sendNewLoanMessageSafely(loanId: string): Promise<void> {
    try {
      const messageLog =
        await this.newLoanReminderService.sendNewLoanMessage(loanId);
      if (messageLog.status === MessageLogStatus.Sent) {
        await this.loansRepository.update(
          { id: loanId },
          { newLoanMessageSentAt: new Date() },
        );
      }
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
    loansRepository: Repository<Loan>,
  ): Promise<void> {
    const existing = await loansRepository.findOne({
      where: { promissoryNoteNumber },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException(
        `A loan with promissory note number ${promissoryNoteNumber} already exists`,
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

function toPayoffInstallmentInput(
  installment: Installment,
): PayoffInstallmentInput {
  return {
    installmentId: installment.id,
    installmentNumber: installment.installmentNumber,
    amount: installment.amount,
    principalPortion: installment.principalPortion,
    dueDate: installment.dueDate,
  };
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
