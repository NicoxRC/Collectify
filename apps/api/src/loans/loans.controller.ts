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
import { QueryLoansDto } from './dto/queryLoans.dto';
import { RefinanceLoanDto } from './dto/refinanceLoan.dto';
import { Loan } from './entities/loan.entity';
import { Payment } from './entities/payment.entity';
import { LoansService, LoanDetail, LoanSummary } from './loans.service';

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
      'installmentAmounts is required — one explicit amount per installment, must sum to principalAmount. Due dates are auto-generated from disbursedAt + installmentFrequency.',
  })
  @ApiResponse({
    status: 201,
    description: 'Returns the created loan and its installments.',
  })
  @ApiResponse({
    status: 400,
    description: 'installmentAmounts does not sum to principalAmount.',
  })
  @ApiResponse({
    status: 409,
    description: 'Promissory note number already in use.',
  })
  create(@Body() dto: CreateLoanDto): Promise<LoanDetail> {
    return this.loansService.create(dto);
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
      'note number and installments generated the same way as loan creation (explicit ' +
      'installmentAmounts, must sum to principalAmount).',
  })
  @ApiResponse({
    status: 201,
    description: 'Returns the new loan and its installments.',
  })
  @ApiResponse({
    status: 400,
    description:
      'The loan is not active (already paid or already refinanced), or installmentAmounts does not sum to principalAmount.',
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
