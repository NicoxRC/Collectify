import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class QueryUsersDto {
  @ApiPropertyOptional({
    description: 'true for active users (default), false for deactivated ones',
    default: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value !== 'false')
  @IsBoolean()
  isActive?: boolean;
}
