import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsUUID, Min } from 'class-validator';

import { ConceptCalculationType } from '../../interestConceptTypes/entities/interestConceptType.entity';

// Confirmed with the human after client QA: a loan's concepts are fixed
// for its whole term, set once at creation — never per-installment — since
// that's what makes the level-payment (cuota fija) schedule well-defined.
// See docs/phases/PHASE_14_INTEREST_CONCEPTS.md.
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
