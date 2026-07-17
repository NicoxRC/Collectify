import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

// Only interest_rate and description are editable post-creation.
// interest_rate is confirmed manually editable per docs/DATABASE.md.
// description is plain metadata with no cascading effects. Other fields
// (principal, schedule) would have cascading effects on already-generated
// installments that aren't scoped here.
export class UpdateLoanDto {
  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  interestRate?: number;

  @ApiPropertyOptional({
    example: 'Compra de Apple MacBook Air M5, 512GB',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
