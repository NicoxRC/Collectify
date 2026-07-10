import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export enum OverdueClientsSortBy {
  TotalOverdueAmount = 'totalOverdueAmount',
  MaxOverdueDays = 'maxOverdueDays',
}

export class QueryOverdueClientsDto {
  @ApiPropertyOptional({
    enum: OverdueClientsSortBy,
    default: OverdueClientsSortBy.TotalOverdueAmount,
  })
  @IsOptional()
  @IsEnum(OverdueClientsSortBy)
  sortBy?: OverdueClientsSortBy;

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
