import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { InstallmentFrequency } from '../entities/loan.entity';

// The new loan created by a refinance is built the same way any other loan
// is (see CreateLoanDto) — explicit per-installment amounts, no auto-split.
// clientId isn't accepted here: the new loan always belongs to the same
// client as the loan being refinanced.
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
      'The exact renegotiated amount, entered by the admin — typically the old balance plus accrued interest, but not auto-calculated (this is a business decision).',
  })
  @IsPositive()
  principalAmount!: number;

  @ApiProperty({
    example: 5,
    description: "The new loan's own interest rate, percentage.",
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

  @ApiProperty({
    example: [317000, 317000, 316000],
    description:
      'One amount per installment, in order. Must sum to principalAmount.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsPositive({ each: true })
  installmentAmounts!: number[];
}
