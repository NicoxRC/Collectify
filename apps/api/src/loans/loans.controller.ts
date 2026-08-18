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
import { UserRole } from '../users/entities/user.entity';

import { CreateLoanDto } from './dto/createLoan.dto';
import { UpdateLoanDto } from './dto/updateLoan.dto';
import { PreviewScheduleDto } from './dto/previewSchedule.dto';
import { QueryLoansDto } from './dto/queryLoans.dto';
import { RefinanceLoanDto } from './dto/refinanceLoan.dto';
import { Loan } from './entities/loan.entity';
import { Payment } from './entities/payment.entity';
import {
  LoansService,
  LoanDetail,
  LoanSummary,
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

  @Post()
  @Roles(UserRole.Admin)
  @Audit('loan.create', 'loan')
  @ApiOperation({
    summary: 'Create a loan and generate its installments (admin only)',
    description:
      'The installment schedule is generated automatically from principalAmount, totalInstallments, and concepts (interest/fee concepts picked from the InterestConceptTypes catalog) — see docs/phases/PHASE_14_INTEREST_CONCEPTS.md. Concepts apply to every installment unless overridden per installment via installmentConceptOverrides. Due dates are auto-generated from disbursedAt + installmentFrequency. interestRate is used only for moratory interest on overdue installments. If the schedule exceeds the current usury ceiling, the loan is still created (usuryCeilingExceededAtCreation is set true on the response) — this is a warning, not a block; usuryJustification records an optional admin note. See docs/phases/PHASE_15_USURY_RATE.md.',
  })
  @ApiResponse({
    status: 201,
    description: 'Returns the created loan and its installments.',
  })
  @ApiResponse({
    status: 400,
    description:
      "An installmentConceptOverrides entry references an installment number outside the loan's totalInstallments, OR the client " +
      'is mora-blocked (an installment more than 30 days overdue), OR the ' +
      "principal exceeds the client's available cupo — see the error " +
      'message for which one applies.',
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

  @Post('preview-schedule')
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary:
      'Preview the generated installment schedule without creating a loan (admin only)',
    description:
      "Runs the same amortization generation as POST /loans, for the admin to review before committing. usuryWarning is present (and non-null) only when the schedule's highest per-installment effective rate exceeds the current usury ceiling — a warning, not a hard block, see docs/phases/PHASE_15_USURY_RATE.md.",
  })
  @ApiResponse({ status: 201, description: 'Returns the previewed schedule.' })
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
      'stored per installment, not per loan (docs/DATABASE.md).',
  })
  @ApiResponse({ status: 200, description: "Returns the loan's payments." })
  @ApiResponse({ status: 404, description: 'Loan not found.' })
  getPayments(@Param('id') id: string): Promise<Payment[]> {
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
      'starting point, per docs/phases/PHASE_17_REFINANCING_RECALC.md.',
  })
  @ApiResponse({
    status: 201,
    description: 'Returns the new loan and its installments.',
  })
  @ApiResponse({
    status: 400,
    description:
      "The loan is not active (already paid or already refinanced), or an installmentConceptOverrides entry references an installment number outside the loan's totalInstallments.",
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
