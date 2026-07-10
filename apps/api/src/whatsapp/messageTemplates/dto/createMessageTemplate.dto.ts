import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMessageTemplateDto {
  @ApiProperty({ example: 'Weekly overdue reminder' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    example:
      'Hola {{clientFullName}}, tienes cuotas vencidas:\n{{installmentsList}}\nEl valor a pagar hoy es ${{grandTotal}}',
  })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
