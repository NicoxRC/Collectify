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
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { InstallmentFrequency } from '../entities/loan.entity';

import {
  InstallmentConceptOverrideDto,
  LoanConceptAssignmentDto,
} from './loanConceptAssignment.dto';

// The new loan created by a refinance is built the same way any other loan
// is (see CreateLoanDto) — its schedule is generated from principalAmount,
// totalInstallments, and concepts, as of Phase 14. clientId isn't accepted
// here: the new loan always belongs to the same client as the loan being
// refinanced.
export class RefinanceLoanDto {
  @ApiProperty({
    example: '#1000',
    description: "The new loan's own promissory note number.",
  })
  @IsString()
  @IsNotEmpty()
  promissoryNoteNumber!: string;

  @ApiProperty({
    example: 950000,
    description:
      'The exact renegotiated amount, entered by the admin — typically the old balance plus accrued interest, but not auto-calculated (this is a business decision — see docs/phases/PHASE_6_REFINANCING.md; docs/phases/PHASE_17_REFINANCING_RECALC.md may change this).',
  })
  @IsPositive()
  principalAmount!: number;

  @ApiProperty({
    example: 5,
    description:
      "The new loan's own rate, used only for moratory interest on overdue installments — see CreateLoanDto.",
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate!: number;

  @ApiProperty({ example: '2026-07-10' })
  @IsDateString()
  disbursedAt!: string;

  @ApiProperty({ enum: InstallmentFrequency })
  @IsEnum(InstallmentFrequency)
  installmentFrequency!: InstallmentFrequency;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(1)
  totalInstallments!: number;

  @ApiProperty({
    type: [LoanConceptAssignmentDto],
    description:
      'Baseline interest/fee concepts applied to every installment of the new loan, unless overridden — see CreateLoanDto.',
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
      '0-based index into the generated schedule marking that installment as the initial payment ("cuota inicial") — exempt from mora regardless of due date. Omit if the new loan has no initial installment. See docs/phases/PHASE_13_INITIAL_INSTALLMENT.md.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  initialInstallmentIndex?: number;

  @ApiPropertyOptional({
    example: 'Refinanciación del pagaré anterior',
    description:
      'Free-text concept/reason for the new loan — used in the "new loan" WhatsApp message, if set.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'Cliente antiguo, aprobado por el dueño.',
    description:
      'Optional note explaining why the new loan proceeds despite exceeding the current usury ceiling — see CreateLoanDto.',
  })
  @IsOptional()
  @IsString()
  usuryJustification?: string;
}
