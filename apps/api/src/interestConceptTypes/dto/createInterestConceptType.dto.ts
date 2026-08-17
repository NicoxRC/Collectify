import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { ConceptCalculationType } from '../entities/interestConceptType.entity';

export class CreateInterestConceptTypeDto {
  @ApiProperty({ example: 'Gastos de cobranza' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: ConceptCalculationType })
  @IsEnum(ConceptCalculationType)
  defaultCalculationType!: ConceptCalculationType;

  @ApiPropertyOptional({
    description:
      'Suggested starting value (percentage points, or a fixed currency amount, depending on defaultCalculationType). Always overridable per installment when applying this type to a loan.',
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultValue?: number;
}
