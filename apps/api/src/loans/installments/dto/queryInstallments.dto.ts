import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

import { InstallmentStatus } from '../../entities/installment.entity';

export class QueryInstallmentsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  loanId?: string;

  @ApiPropertyOptional({ enum: InstallmentStatus })
  @IsOptional()
  @IsEnum(InstallmentStatus)
  status?: InstallmentStatus;

  @ApiPropertyOptional({
    description: 'Only pending installments past their due date',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === 'true')
  @IsBoolean()
  overdueOnly?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
