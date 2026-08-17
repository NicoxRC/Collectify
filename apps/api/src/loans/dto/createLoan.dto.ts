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
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { InstallmentFrequency } from '../entities/loan.entity';

import {
  InstallmentConceptOverrideDto,
  LoanConceptAssignmentDto,
} from './loanConceptAssignment.dto';

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
      'Baseline interest/fee concepts applied to every installment, unless overridden for a specific one via installmentConceptOverrides. Can be empty for an interest-free financing plan.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoanConceptAssignmentDto)
  concepts!: LoanConceptAssignmentDto[];

  @ApiPropertyOptional({ type: [InstallmentConceptOverrideDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstallmentConceptOverrideDto)
  installmentConceptOverrides?: InstallmentConceptOverrideDto[];

  @ApiPropertyOptional({
    example: 0,
    description:
      '0-based index into the generated schedule marking that installment as the initial payment ("cuota inicial") — exempt from mora regardless of due date. Omit if the loan has no initial installment. See docs/phases/PHASE_13_INITIAL_INSTALLMENT.md.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  initialInstallmentIndex?: number;

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
}
