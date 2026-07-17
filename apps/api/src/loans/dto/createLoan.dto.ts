import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

import { InstallmentFrequency } from '../entities/loan.entity';

// Installment amounts are always explicit, per human decision — see the
// Phase 4 PR discussion. No automatic even-split; the caller provides one
// amount per installment, and their sum must equal principalAmount.
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
    description: 'Percentage — set manually per loan, per docs/DATABASE.md',
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

  @ApiProperty({
    example: [300000, 300000, 300000],
    description:
      'One amount per installment, in order. Must sum to principalAmount.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsPositive({ each: true })
  installmentAmounts!: number[];

  @ApiPropertyOptional({
    example:
      'Compra de Apple MacBook Air M5 color silver blue, 512GB, 16GB de ram',
    description:
      'Free-text concept/reason for the loan — used in the "new loan" WhatsApp message, if set.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
