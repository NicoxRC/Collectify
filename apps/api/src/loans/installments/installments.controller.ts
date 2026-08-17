import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Audit } from '../../auditLog/decorators/audit.decorator';
import { CurrentUser } from '../../auth/decorators/currentUser.decorator';
import { PaginatedResult } from '../../common/interfaces/paginatedResult.interface';
import { Payment } from '../entities/payment.entity';

import { CreatePaymentDto } from './dto/createPayment.dto';
import { QueryInstallmentsDto } from './dto/queryInstallments.dto';
import { InstallmentWithCalculated } from './enrichInstallment';
import { InstallmentsService } from './installments.service';

import type { AuthenticatedUser } from '../../auth/interfaces/authenticatedUser.interface';

@ApiTags('installments')
@ApiBearerAuth()
@Controller('installments')
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List installments (filterable by loan/status/overdue-only)',
    description:
      'Each installment includes principalPortion and conceptBreakdown ' +
      '(name + amount per interest/fee concept), computed once at schedule ' +
      'generation time — see docs/phases/PHASE_14_INTEREST_CONCEPTS.md.',
  })
  @ApiResponse({ status: 200, description: 'Returns a page of installments.' })
  findAll(
    @Query() query: QueryInstallmentsDto,
  ): Promise<PaginatedResult<InstallmentWithCalculated>> {
    return this.installmentsService.findAll(query);
  }

  @Post(':id/payments')
  @Audit('payment.register', 'payment')
  @ApiOperation({
    summary: 'Register a payment against an installment',
    description:
      'Accepts an optional imageUrl for the deposit receipt photo. The api does not handle image uploads — imageUrl must already point to an externally hosted image (see docs/phases/PHASE_12_PAYMENT_ATTACHMENTS.md); the client is responsible for uploading the file and passing back the resulting URL.',
  })
  @ApiResponse({ status: 201, description: 'The payment was recorded.' })
  @ApiResponse({ status: 404, description: 'Installment not found.' })
  registerPayment(
    @Param('id') id: string,
    // Previously uncaptured entirely (see docs/phases/PHASE_11_AUDIT_LOG.md
    // "Scope decisions") — now available for AuditLogInterceptor to read
    // off the request. Not passed to the service: the audit log entry
    // itself is the record of who registered this payment, per that same
    // note, rather than a denormalized column on Payment. Placed before
    // `dto` (not after) so it stays exempt from
    // @typescript-eslint/no-unused-vars' default `args: 'after-used'`
    // option — same reason `_data` precedes `ctx` in
    // currentUser.decorator.ts and `_context` precedes `next` in
    // response.interceptor.ts. Param order has no functional effect on
    // NestJS route binding, which matches by decorator, not position.
    @CurrentUser() _currentUser: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
  ): Promise<Payment> {
    return this.installmentsService.registerPayment(id, dto);
  }
}
