import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  Min,
  ValidateNested,
} from 'class-validator';

import { InstallmentFrequency } from '../entities/loan.entity';

import {
  InstallmentConceptOverrideDto,
  LoanConceptAssignmentDto,
} from './loanConceptAssignment.dto';

// Same shape as the schedule-relevant subset of CreateLoanDto — no
// clientId/promissoryNoteNumber/interestRate, since nothing is persisted
// and moratory interestRate doesn't affect the generated schedule.
export class PreviewScheduleDto {
  @ApiProperty({ example: 900000 })
  @IsPositive()
  principalAmount!: number;

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

  @ApiProperty({ type: [LoanConceptAssignmentDto] })
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
}
