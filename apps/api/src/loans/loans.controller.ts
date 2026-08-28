import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Audit } from '../auditLog/decorators/audit.decorator';
import { PaginatedResult } from '../common/interfaces/paginatedResult.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireModule } from '../auth/decorators/requireModule.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AppModule } from '../users/entities/userModulePermission.entity';

import { CreateLoanDto } from './dto/createLoan.dto';
import { UpdateLoanDto } from './dto/updateLoan.dto';
import { PreviewScheduleDto } from './dto/previewSchedule.dto';
import { QueryLoansDto } from './dto/queryLoans.dto';
import { RefinanceLoanDto } from './dto/refinanceLoan.dto';
import { Loan } from './entities/loan.entity';
import {
  LoansService,
  LoanDetail,
  LoanSummary,
  PaymentWithImages,
  RefinanceQuote,
  SchedulePreview,
} from './loans.service';
import { PayoffQuote } from './payoff/calculatePayoff';

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  @ApiOperation({
    summary: 'List loans (paginated, filterable by client/status)',
    description:
      'Each row includes clientFullName, outstandingBalance, installmentsPaid, ' +
      'overdueDays, nextInstallmentDueDate, and overdueBalance — aggregated ' +
      "from the loan's installments, for the standalone Préstamos list " +
      'screen (does not require opening the loan). outstandingBalance sums ' +
      'every pending installment (overdue or not); overdueBalance sums ' +
      'only the overdue ones. search matches the client name or ' +
      'promissory note number.',
  })
  @ApiResponse({ status: 200, description: 'Returns a page of loans.' })
  findAll(
    @Query() query: QueryLoansDto,
  ): Promise<PaginatedResult<LoanSummary>> {
    return this.loansService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a loan with its installments',
    description:
      'overdueDays, interest, and totalDue on each installment are calculated on read, never stored. ' +
      'principalPortion and conceptBreakdown (name + amount per interest/fee concept) were computed ' +
      'once at schedule generation time and are read back as stored — see ' +
      'docs/phases/PHASE_14_INTEREST_CONCEPTS.md. ' +
      'refinancedToLoanId is a computed reverse lookup — the loan this one was later refinanced into, if any.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the loan and its installments.',
  })
  @ApiResponse({ status: 404, description: 'Loan not found.' })
  findOne(@Param('id') id: string): Promise<LoanDetail> {
    return this.loansService.findOne(id);
  }

  // Phase 23 — was admin-only (@Roles(UserRole.Admin)); relaxed to
  // @RequireModule so a collector granted the `loans` module can create a
  // loan too, per the client's explicit ask ("los cobradores... sí deben
  // poder crear el crédito"). See docs/phases/PHASE_23_DYNAMIC_CHARGES.md
  // "Permissions" for the full reasoning, including why
  // preview-schedule/GET interest-concept-types below are handled
  // differently.
  @Post()
  @RequireModule(AppModule.Loans)
  @Audit('loan.create', 'loan')
  @ApiOperation({
    summary:
      'Create a loan and generate its installments (admin or granted the loans module)',
    description:
      'The installment schedule is generated automatically from principalAmount, totalInstallments, and concepts (interest/fee concepts picked from the InterestConceptTypes catalog), solved as a level total payment ("cuota fija") — see docs/phases/PHASE_14_INTEREST_CONCEPTS.md. Concepts apply to every installment for the whole term of the loan; they cannot vary per installment. moratoryConcepts (Phase 23) are assigned the same way but never affect the schedule — they only take effect once an installment is overdue. Due dates are auto-generated from disbursedAt + installmentFrequency. interestRate is the legacy fallback used for moratory interest only when no moratoryConcepts are assigned. As of Phase 24, a loan cannot be created without the current calendar month\'s usury rate on file (see GET /usury-rates/current), and any percentage-type concept (corriente or moratorio) is automatically priced at exactly that rate, ignoring whatever value is sent for it — only fixed_amount concepts stay admin-set. See docs/phases/PHASE_24_USURY_MANDATORY.md.',
  })
  @ApiResponse({
    status: 201,
    description: 'Returns the created loan and its installments.',
  })
  @ApiResponse({
    status: 400,
    description:
      'The client is mora-blocked (an installment more than 30 days overdue), the ' +
      "principal exceeds the client's available cupo, or the current month's usury rate " +
      'has not been entered yet — see the error message for which one applies.',
  })
  @ApiResponse({
    status: 404,
    description: 'A concept references an unknown concept type id.',
  })
  @ApiResponse({
    status: 409,
    description: 'Promissory note number already in use.',
  })
  create(@Body() dto: CreateLoanDto): Promise<LoanDetail> {
    return this.loansService.create(dto);
  }

  // Deliberately open to any authenticated user — same as GET
  // /interest-concept-types, and for the same reason (Phase 23): this is a
  // stateless calculator that touches no client data and persists nothing
  // (confirmed 2026-08-18 for the standalone /cotizador screen, which calls
  // this exact endpoint). "Collectors shouldn't see the amortizador" is
  // implemented as a frontend-only UI decision in LoanForm.tsx, not a
  // backend restriction — see docs/phases/PHASE_23_DYNAMIC_CHARGES.md
  // "Permissions".
  @Post('preview-schedule')
  @ApiOperation({
    summary:
      'Preview the generated installment schedule without creating a loan',
    description:
      "Runs the same amortization generation as POST /loans, for review before committing — including the same Phase 24 hard block and percentage-concept auto-fill, so what's previewed always matches what a real submit would persist. See docs/phases/PHASE_24_USURY_MANDATORY.md.",
  })
  @ApiResponse({ status: 201, description: 'Returns the previewed schedule.' })
  @ApiResponse({
    status: 400,
    description: "The current month's usury rate has not been entered yet.",
  })
  @ApiResponse({
    status: 404,
    description: 'A concept references an unknown concept type id.',
  })
  previewSchedule(@Body() dto: PreviewScheduleDto): Promise<SchedulePreview> {
    return this.loansService.previewSchedule(dto);
  }

  @Patch(':id')
  @Roles(UserRole.Admin)
  @Audit('loan.update', 'loan')
  @ApiOperation({ summary: "Update a loan's interest rate (admin only)" })
  @ApiResponse({ status: 200, description: 'The loan was updated.' })
  @ApiResponse({ status: 404, description: 'Loan not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateLoanDto): Promise<Loan> {
    return this.loansService.update(id, dto);
  }

  @Post(':id/mark-as-paid')
  @Roles(UserRole.Admin)
  @Audit('loan.markAsPaid', 'loan')
  @ApiOperation({
    summary:
      'Manually close a loan out as paid (admin only) — for payments received outside the system',
    description:
      "Sets the loan's status to 'paid' and every still-pending installment to " +
      "'paid' as well, so the loan and its installments stay consistent. Does " +
      'NOT create Payment rows — there is no per-installment amount/date to ' +
      'record for this kind of manual override. Only active loans can be ' +
      "marked paid this way; 'al día'/'en mora' are not stored states (see " +
      'docs/DATABASE.md) so there is nothing to set for those.',
  })
  @ApiResponse({ status: 200, description: 'The loan was marked as paid.' })
  @ApiResponse({
    status: 400,
    description: 'The loan is not active (already paid or refinanced).',
  })
  @ApiResponse({ status: 404, description: 'Loan not found.' })
  markAsPaid(@Param('id') id: string): Promise<LoanDetail> {
    return this.loansService.markAsPaid(id);
  }

  @Get(':id/payoff-quote')
  @ApiOperation({
    summary: 'Quote how much it costs to close this loan out today',
    description:
      "Never blindly sums remaining installment totals — implements the confirmed imputación rule (Colombian Civil Code Art. 1653, see docs/phases/PHASE_16_EARLY_PAYOFF.md). A matured installment (due today or already overdue) contributes its Phase 14 concept charges plus any moratory interest as 'interest', and its principalPortion as 'principal'. A not-yet-due installment contributes ONLY its principalPortion, at face value, with zero interest — no interest is ever charged for a period that hasn't happened yet. An initial installment (Phase 13) contributes only principal, never interest. Read-only; safe to call regardless of the loan's status.",
  })
  @ApiResponse({ status: 200, description: 'Returns the payoff quote.' })
  @ApiResponse({ status: 404, description: 'Loan not found.' })
  getPayoffQuote(@Param('id') id: string): Promise<PayoffQuote> {
    return this.loansService.getPayoffQuote(id);
  }

  @Post(':id/payoff')
  @Roles(UserRole.Admin)
  @Audit('loan.payoff', 'loan')
  @ApiOperation({
    summary:
      'Settle the loan today for its full payoff quote, closing it out (admin only)',
    description:
      "A separate, explicit flow from registering an ordinary payment — POST /installments/:id/payments and its one-payment-per-installment behavior are completely untouched. Always settles the FULL amount from GET /loans/:id/payoff-quote; there is no partial early payoff. Registers one real Payment row per still-pending installment (observation: 'Liquidación anticipada'), marks every installment and the loan 'paid'.",
  })
  @ApiResponse({ status: 200, description: 'The loan was paid off.' })
  @ApiResponse({
    status: 400,
    description: 'The loan is not active (already paid or refinanced).',
  })
  @ApiResponse({ status: 404, description: 'Loan not found.' })
  payoff(@Param('id') id: string): Promise<LoanDetail> {
    return this.loansService.payoff(id);
  }

  @Get(':id/payments')
  @ApiOperation({
    summary: "List a loan's payment history, oldest first",
    description:
      'Joins across every installment belonging to this loan — payments are ' +
      'stored per installment, not per loan (docs/DATABASE.md). Each payment ' +
      'includes imageUrls (Phase 28) — a payment can carry more than one ' +
      'receipt photo.',
  })
  @ApiResponse({ status: 200, description: "Returns the loan's payments." })
  @ApiResponse({ status: 404, description: 'Loan not found.' })
  getPayments(@Param('id') id: string): Promise<PaymentWithImages[]> {
    return this.loansService.getPayments(id);
  }

  @Get(':id/refinance-quote')
  @ApiOperation({
    summary:
      'Suggest a new principal and carried-over concepts for refinancing this loan',
    description:
      "Reopens docs/phases/PHASE_6_REFINANCING.md's manual-entry decision, per " +
      'docs/phases/PHASE_17_REFINANCING_RECALC.md — advisory only, POST /loans/:id/refinance ' +
      'still accepts whatever principalAmount/concepts are actually submitted, unchanged. ' +
      "suggestedPrincipalAmount reuses GET /loans/:id/payoff-quote's totalDue directly (the same " +
      'figure a payoff quote would show), so the two can never disagree on what the client ' +
      "currently owes. concepts carries over the old loan's first installment's concepts, " +
      'excluding any whose catalog type was since deleted.',
  })
  @ApiResponse({ status: 200, description: 'Returns the refinance quote.' })
  @ApiResponse({ status: 404, description: 'Loan not found.' })
  getRefinanceQuote(@Param('id') id: string): Promise<RefinanceQuote> {
    return this.loansService.getRefinanceQuote(id);
  }

  @Post(':id/refinance')
  @Roles(UserRole.Admin)
  @Audit('loan.refinance', 'loan')
  @ApiOperation({
    summary: 'Refinance a loan: close it out and open a new one (admin only)',
    description:
      "Sets the old loan's status to 'refinanced' and cancels whatever installments it still had " +
      "pending (marked 'cancelled' — excluded from active collection/reminders, kept as historical " +
      'record). Creates a new loan linked back via refinancedFromLoanId, with its own promissory ' +
      'note number and a schedule generated the same way as loan creation (principalAmount, ' +
      'totalInstallments, and concepts — see POST /loans). principalAmount and concepts are still ' +
      'exactly what the admin submits — see GET /loans/:id/refinance-quote for a suggested ' +
      'starting point, per docs/phases/PHASE_17_REFINANCING_RECALC.md. The client must be current ' +
      'on the old loan first: rejected if any installment is overdue and unpaid, or — once the ' +
      'most overdue installment reaches 8 days past due — if the installment right after it is ' +
      'also unpaid, even though its own due date has not arrived yet. ' +
      'GET /loans/:id/refinance-quote surfaces the same check in advance via ' +
      'blockedByPendingInstallments. As of Phase 24, the same hard block and percentage-concept ' +
      'auto-fill rules POST /loans uses apply here too — see docs/phases/PHASE_24_USURY_MANDATORY.md.',
  })
  @ApiResponse({
    status: 201,
    description: 'Returns the new loan and its installments.',
  })
  @ApiResponse({
    status: 400,
    description:
      'The loan is not active (already paid or already refinanced), the client is not yet ' +
      "current on it, or the current month's usury rate has not been entered yet — see the " +
      'description above.',
  })
  @ApiResponse({ status: 404, description: 'Loan not found.' })
  @ApiResponse({
    status: 409,
    description: 'Promissory note number already in use.',
  })
  refinance(
    @Param('id') id: string,
    @Body() dto: RefinanceLoanDto,
  ): Promise<LoanDetail> {
    return this.loansService.refinance(id, dto);
  }
}
