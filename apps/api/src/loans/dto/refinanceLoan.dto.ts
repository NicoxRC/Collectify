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

import { LoanConceptAssignmentDto } from './loanConceptAssignment.dto';

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
      'Interest/fee concepts applied to every installment of the new loan for its whole term — see CreateLoanDto.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoanConceptAssignmentDto)
  concepts!: LoanConceptAssignmentDto[];

  @ApiPropertyOptional({
    type: [LoanConceptAssignmentDto],
    description:
      'Moratory concepts assigned to the new loan — see CreateLoanDto.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LoanConceptAssignmentDto)
  moratoryConcepts?: LoanConceptAssignmentDto[];

  @ApiPropertyOptional({
    example: 50000,
    description:
      'The new loan\'s own "cuota inicial" — see CreateLoanDto. Purely informational, unrelated to the loan being refinanced.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialPayment?: number;

  @ApiPropertyOptional({
    example: 'Refinanciación del pagaré anterior',
    description:
      'Free-text concept/reason for the new loan — used in the "new loan" WhatsApp message, if set.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  // --- Optional co-debtor (codeudor) for the new loan, Phase 26. Omit to
  // carry over the old loan's co-debtor unchanged (LoansService.refinance
  // defaults to that — coDebtorClientId + coDebtorRelationship both);
  // pass either field to override. Must not be the same client as the
  // loan's own client — enforced in LoansService. See
  // docs/phases/PHASE_26_CODEBTOR_CLIENT.md. ---

  @ApiPropertyOptional({
    description:
      "An existing client's id, picked as this loan's co-debtor. Omit to carry over the old " +
      "loan's co-debtor unchanged; send null explicitly to deliberately clear it on the new " +
      'loan instead of carrying it over.',
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  coDebtorClientId?: string | null;

  @ApiPropertyOptional({
    example: 'Hermano del deudor',
    description:
      "This loan's relationship between the debtor and the co-debtor — free text. Same " +
      'omit-to-carry-over/null-to-clear rule as coDebtorClientId.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  coDebtorRelationship?: string | null;
}
