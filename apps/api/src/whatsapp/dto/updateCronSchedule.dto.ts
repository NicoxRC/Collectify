import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateCronScheduleDto {
  @ApiProperty({ example: '0 9 * * 1,3,5' })
  @IsString()
  @IsNotEmpty()
  cronExpression!: string;
}
