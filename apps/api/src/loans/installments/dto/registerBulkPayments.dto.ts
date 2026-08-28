import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  IsUrl,
  ValidateNested,
} from 'class-validator';

// One entry in a bulk payment request — same shape as CreatePaymentDto plus
// installmentId, since a bulk request pays several installments at once
// (confirmed with the human: amount is entered individually per
// installment, not a single total split across them). See
// docs/phases/PHASE_28_MULTI_INSTALLMENT_PAYMENT.md.
export class BulkPaymentEntryDto {
  @ApiProperty()
  @IsUUID()
  installmentId!: string;

  @ApiProperty({ example: 150000 })
  @IsPositive()
  amountPaid!: number;

  @ApiProperty({ example: '2026-07-09' })
  @IsDateString()
  paidAt!: string;

  @ApiPropertyOptional({ example: 'Pagó en el local' })
  @IsOptional()
  @IsString()
  observation?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  imageUrls?: string[];
}

// Confirmed with the human: a bulk action requires FULL payment of every
// selected installment — partial payment stays on the existing
// single-installment POST /installments/:id/payments flow, which already
// supports it. InstallmentsService.registerBulkPayments() enforces this
// server-side, not just as a UI nicety.
export class RegisterBulkPaymentsDto {
  @ApiProperty({ type: [BulkPaymentEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkPaymentEntryDto)
  payments!: BulkPaymentEntryDto[];
}
