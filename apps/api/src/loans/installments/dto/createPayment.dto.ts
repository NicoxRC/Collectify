import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ example: 150000 })
  @IsPositive()
  amountPaid!: number;

  @ApiProperty({ example: '2026-07-09' })
  @IsDateString()
  paidAt!: string;

  @ApiPropertyOptional({ example: 'Pagó en el local' })
  @IsOptional()
  @IsString()
  observation?: string;
}
