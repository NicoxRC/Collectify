import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

import { ConceptCalculationType } from '../../interestConceptTypes/entities/interestConceptType.entity';

export class LoanConceptAssignmentDto {
  @ApiProperty({
    description: 'Must reference an active InterestConceptType.',
  })
  @IsUUID()
  conceptTypeId!: string;

  @ApiProperty({ enum: ConceptCalculationType })
  @IsEnum(ConceptCalculationType)
  calculationType!: ConceptCalculationType;

  @ApiProperty({
    description:
      'Percentage points (for percentage concepts, applied to the balance outstanding before this installment) or a fixed currency amount (for fixed_amount concepts).',
    example: 2,
  })
  @IsNumber()
  @Min(0)
  value!: number;
}

// Lets concepts vary installment-to-installment (confirmed with the human
// — see docs/phases/PHASE_14_INTEREST_CONCEPTS.md). Most loans won't need
// this; the baseline `concepts` array on CreateLoanDto/RefinanceLoanDto
// applies to every installment unless overridden here for a specific one.
export class InstallmentConceptOverrideDto {
  @ApiProperty({
    description: '1-indexed installment number this override applies to.',
    example: 1,
  })
  @IsInt()
  @Min(1)
  installmentNumber!: number;

  @ApiProperty({ type: [LoanConceptAssignmentDto] })
  @ValidateNested({ each: true })
  @Type(() => LoanConceptAssignmentDto)
  concepts!: LoanConceptAssignmentDto[];
}
