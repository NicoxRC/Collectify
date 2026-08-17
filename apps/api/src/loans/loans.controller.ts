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
  PreviewedInstallment,
} from './loans.service';

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
  @ApiOperation({
    summary: 'Create a loan and generate its installments (admin only)',
    description:
      'The installment schedule is generated automatically from principalAmount, totalInstallments, and concepts (interest/fee concepts picked from the InterestConceptTypes catalog) — see docs/phases/PHASE_14_INTEREST_CONCEPTS.md. Concepts apply to every installment unless overridden per installment via installmentConceptOverrides. Due dates are auto-generated from disbursedAt + installmentFrequency. interestRate is used only for moratory interest on overdue installments.',
  })
  @ApiResponse({
    status: 201,
    description: 'Returns the created loan and its installments.',
  })
  @ApiResponse({
    status: 400,
    description:
      "An installmentConceptOverrides entry references an installment number outside the loan's totalInstallments.",
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
      'Runs the same amortization generation as POST /loans, for the admin to review before committing.',
  })
  @ApiResponse({ status: 201, description: 'Returns the previewed schedule.' })
  @ApiResponse({
    status: 404,
    description: 'A concept references an unknown concept type id.',
  })
  previewSchedule(
    @Body() dto: PreviewScheduleDto,
  ): Promise<PreviewedInstallment[]> {
    return this.loansService.previewSchedule(dto);
  }

  @Patch(':id')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: "Update a loan's interest rate (admin only)" })
  @ApiResponse({ status: 200, description: 'The loan was updated.' })
  @ApiResponse({ status: 404, description: 'Loan not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateLoanDto): Promise<Loan> {
    return this.loansService.update(id, dto);
  }

  @Post(':id/mark-as-paid')
  @Roles(UserRole.Admin)
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

  @Post(':id/refinance')
  @Roles(UserRole.Admin)
  @ApiOperation({
    summary: 'Refinance a loan: close it out and open a new one (admin only)',
    description:
      "Sets the old loan's status to 'refinanced' and cancels whatever installments it still had " +
      "pending (marked 'cancelled' — excluded from active collection/reminders, kept as historical " +
      'record). Creates a new loan linked back via refinancedFromLoanId, with its own promissory ' +
      'note number and a schedule generated the same way as loan creation (principalAmount, ' +
      'totalInstallments, and concepts — see POST /loans).',
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
