import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class QueryInterestConceptTypesDto {
  @ApiPropertyOptional({
    description:
      'true for active concept types (default), false for deactivated ones',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value !== 'false')
  @IsBoolean()
  isActive?: boolean;
}
