import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

// Only interest_rate is editable post-creation — it's confirmed manually
// editable per docs/DATABASE.md. Other fields (principal, schedule) would
// have cascading effects on already-generated installments that aren't
// scoped here.
export class UpdateLoanDto {
  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate?: number;
}
