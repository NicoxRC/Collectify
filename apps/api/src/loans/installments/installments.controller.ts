import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { PaginatedResult } from '../../common/interfaces/paginatedResult.interface';
import { Payment } from '../entities/payment.entity';

import { CreatePaymentDto } from './dto/createPayment.dto';
import { QueryInstallmentsDto } from './dto/queryInstallments.dto';
import { InstallmentWithCalculated } from './enrichInstallment';
import { InstallmentsService } from './installments.service';

@ApiTags('installments')
@ApiBearerAuth()
@Controller('installments')
export class InstallmentsController {
  constructor(private readonly installmentsService: InstallmentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List installments (filterable by loan/status/overdue-only)',
  })
  @ApiResponse({ status: 200, description: 'Returns a page of installments.' })
  findAll(
    @Query() query: QueryInstallmentsDto,
  ): Promise<PaginatedResult<InstallmentWithCalculated>> {
    return this.installmentsService.findAll(query);
  }

  @Post(':id/payments')
  @ApiOperation({ summary: 'Register a payment against an installment' })
  @ApiResponse({ status: 201, description: 'The payment was recorded.' })
  @ApiResponse({ status: 404, description: 'Installment not found.' })
  registerPayment(
    @Param('id') id: string,
    @Body() dto: CreatePaymentDto,
  ): Promise<Payment> {
    return this.installmentsService.registerPayment(id, dto);
  }
}
