import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { PaginatedResult } from '../common/interfaces/paginatedResult.interface';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

import { UpdateLoanDto } from './dto/updateLoan.dto';
import { QueryLoansDto } from './dto/queryLoans.dto';
import { Loan } from './entities/loan.entity';
import { LoansService, LoanDetail } from './loans.service';

// POST /loans (create + installment generation) is intentionally not
// implemented yet — docs/phases/PHASE_4_LOANS_INSTALLMENTS.md requires
// resolving whether installment amounts are always an even split or can be
// customized per installment before building it. Pending human confirmation.

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  @ApiOperation({
    summary: 'List loans (paginated, filterable by client/status)',
  })
  @ApiResponse({ status: 200, description: 'Returns a page of loans.' })
  findAll(@Query() query: QueryLoansDto): Promise<PaginatedResult<Loan>> {
    return this.loansService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a loan with its installments',
    description:
      'overdueDays, interest, and totalDue on each installment are calculated on read, never stored.',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns the loan and its installments.',
  })
  @ApiResponse({ status: 404, description: 'Loan not found.' })
  findOne(@Param('id') id: string): Promise<LoanDetail> {
    return this.loansService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.Admin)
  @ApiOperation({ summary: "Update a loan's interest rate (admin only)" })
  @ApiResponse({ status: 200, description: 'The loan was updated.' })
  @ApiResponse({ status: 404, description: 'Loan not found.' })
  update(@Param('id') id: string, @Body() dto: UpdateLoanDto): Promise<Loan> {
    return this.loansService.update(id, dto);
  }
}
