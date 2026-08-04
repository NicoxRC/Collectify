import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsPhoneNumber,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateClientDto {
  @ApiProperty({ example: 'Juana' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Pérez' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ example: '1234567890', description: 'Cédula' })
  @IsString()
  @IsNotEmpty()
  documentNumber!: string;

  @ApiProperty({ example: '+573001234567' })
  @IsPhoneNumber('CO')
  phoneNumber!: string;

  @ApiPropertyOptional({
    example: 2000000,
    description:
      'Maximum credit exposure ("cupo") — unset means no cupo is enforced ' +
      'for this client. See docs/phases/PHASE_10_CLIENT_CAPACITY.md.',
  })
  @IsOptional()
  @IsPositive()
  creditLimit?: number;
}
