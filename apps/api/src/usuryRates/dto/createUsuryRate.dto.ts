import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, Min } from 'class-validator';

export class CreateUsuryRateDto {
  @ApiProperty({
    example: '2026-08-01',
    description:
      'Any date within the certified month — normalized to the first day of that month. Rejected if a rate for that month already exists.',
  })
  @IsDateString()
  effectiveMonth!: string;

  @ApiProperty({
    example: 29.5,
    description: "The month's certified usury ceiling, as a percentage.",
  })
  @IsNumber()
  @Min(0)
  ratePercentage!: number;
}
