import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { DocumentType } from '../../clients/entities/client.entity';
import { InstallmentFrequency } from '../entities/loan.entity';

import { LoanConceptAssignmentDto } from './loanConceptAssignment.dto';

// As of Phase 14, installments are no longer hand-entered totals — the
// amortization schedule (loans/amortization/generateSchedule.ts) is
// generated from principalAmount, totalInstallments, and concepts. See
// docs/phases/PHASE_14_INTEREST_CONCEPTS.md.
export class CreateLoanDto {
  @ApiProperty()
  @IsUUID()
  clientId!: string;

  @ApiProperty({ example: '#743' })
  @IsString()
  @IsNotEmpty()
  promissoryNoteNumber!: string;

  @ApiProperty({ example: 900000 })
  @IsPositive()
  principalAmount!: number;

  @ApiProperty({
    example: 6,
    description:
      'Percentage used only for moratory interest on overdue installments (docs/GLOSSARY.md). Ordinary financing cost is expressed through concepts, not this field, as of Phase 14.',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate!: number;

  @ApiProperty({ example: '2026-07-09' })
  @IsDateString()
  disbursedAt!: string;

  @ApiProperty({ enum: InstallmentFrequency })
  @IsEnum(InstallmentFrequency)
  installmentFrequency!: InstallmentFrequency;

  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(1)
  totalInstallments!: number;

  @ApiProperty({
    type: [LoanConceptAssignmentDto],
    description:
      'Interest/fee concepts applied to every installment for the whole term of the loan. Can be empty for an interest-free financing plan.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoanConceptAssignmentDto)
  concepts!: LoanConceptAssignmentDto[];

  @ApiPropertyOptional({
    type: [LoanConceptAssignmentDto],
    description:
      'Moratory concepts assigned to this loan (Phase 23) — each referenced concept type must have category "moratorio". Unlike concepts above, these are never baked into the installment amount or computed at generation time: they only take effect once an installment is actually overdue, computed live on read. Omit or leave empty for a loan with no moratory concepts, which keeps using the legacy interestRate formula.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoanConceptAssignmentDto)
  moratoryConcepts?: LoanConceptAssignmentDto[];

  @ApiPropertyOptional({
    example: 50000,
    description:
      'The "cuota inicial" — a down payment the client already made outside the credit system to cover the part of the purchase this loan doesn\'t finance. Purely informational: it is not one of the loan\'s installments, has no due date, and never affects the amortization schedule. Omit if there was no down payment. See docs/phases/PHASE_13_INITIAL_INSTALLMENT.md.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialPayment?: number;

  @ApiPropertyOptional({
    example:
      'Compra de Apple MacBook Air M5 color silver blue, 512GB, 16GB de ram',
    description:
      'Free-text concept/reason for the loan — used in the "new loan" WhatsApp message, if set.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'Cliente antiguo, aprobado por el dueño.',
    description:
      "Optional note explaining why the loan proceeds despite exceeding the current usury ceiling. Only meaningful when the check (see POST /loans response's usuryCeilingExceededAtCreation) actually fires — this is a warning, not a hard block, see docs/phases/PHASE_15_USURY_RATE.md.",
  })
  @IsOptional()
  @IsString()
  usuryJustification?: string;

  // --- Optional co-debtor (codeudor), Phase 21 — at most one per loan,
  // confirmed with the business. See
  // docs/phases/PHASE_21_CLIENT_PROFILE.md. ---

  @ApiPropertyOptional({ example: 'Carlos Gómez' })
  @IsOptional()
  @IsString()
  coDebtorFullName?: string;

  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  coDebtorDocumentType?: DocumentType;

  @ApiPropertyOptional({ example: '1122334455' })
  @IsOptional()
  @IsString()
  coDebtorDocumentNumber?: string;

  @ApiPropertyOptional({ example: '+573007778899' })
  @IsOptional()
  @IsPhoneNumber('CO')
  coDebtorPhoneNumber?: string;

  @ApiPropertyOptional({ example: 'Cra 10 #20-30' })
  @IsOptional()
  @IsString()
  coDebtorAddress?: string;

  @ApiPropertyOptional({ example: 'Hermano del deudor' })
  @IsOptional()
  @IsString()
  coDebtorRelationship?: string;

  @ApiPropertyOptional({
    description: 'Externally-hosted URL (image or PDF), optional.',
  })
  @IsOptional()
  @IsUrl()
  coDebtorIdDocumentUrl?: string;
}
